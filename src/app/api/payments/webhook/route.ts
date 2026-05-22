import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

// ─── Paystack webhook handler ─────────────────────────────
//
// Register this URL in your Paystack dashboard:
//   Dashboard → Settings → API Keys & Webhooks → Webhook URL
//   → https://yourdomain.com/api/payments/webhook
//
// Paystack signs every webhook with HMAC-SHA512 using your secret key.
// The signature is sent in the "x-paystack-signature" header.

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

function verifyPaystackSignature(body: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(body)
    .digest("hex");
  // Use timingSafeEqual to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ─── Paystack event types ────────────────────────────────

interface PaystackCustomer {
  email: string;
}

interface PaystackChargeData {
  reference: string;
  amount: number; // in kobo/cents (smallest currency unit)
  currency: string;
  status: string;
  channel: string; // e.g. "card", "bank", "ussd", "qr", "mobile_money"
  paid_at: string;
  customer: PaystackCustomer;
  metadata: {
    appointmentId?: string;
    patientId?: string;
  };
}

interface PaystackEvent {
  event: string;
  data: PaystackChargeData;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  // ── Verify webhook authenticity ──────────────────────────
  if (!verifyPaystackSignature(body, signature)) {
    console.warn("Paystack webhook: invalid signature");
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  let event: PaystackEvent;
  try {
    event = JSON.parse(body) as PaystackEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Route events ─────────────────────────────────────────
  switch (event.event) {
    // ── Successful payment ───────────────────────────────
    case "charge.success": {
      const charge = event.data;
      const { appointmentId, patientId } = charge.metadata ?? {};

      if (!appointmentId || !patientId) {
        console.error("Paystack webhook: missing metadata on charge", charge.reference);
        break;
      }

      try {
        await prisma.$transaction(async (tx) => {
          // Find the payment by Paystack reference
          const payment = await tx.payment.findFirst({
            where: { paystackReference: charge.reference },
          });

          if (payment) {
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: "COMPLETED",
                // Normalise channel name → human-readable method
                method: formatChannel(charge.channel),
                paidAt: new Date(charge.paid_at),
              },
            });
          }

          // Confirm the linked appointment
          await tx.appointment.update({
            where: { id: appointmentId },
            data: { status: "CONFIRMED" },
          });

          // Fetch appointment details for notifications
          const appointment = await tx.appointment.findUnique({
            where: { id: appointmentId },
            include: {
              patient: {
                include: { user: { select: { id: true, firstName: true, lastName: true } } },
              },
              doctor: {
                include: { user: { select: { id: true, firstName: true, lastName: true } } },
              },
            },
          });

          if (!appointment) return;

          // Paystack amount is in kobo/cents — convert to decimal
          const amountFormatted = formatAmount(charge.amount, charge.currency);

          // Notify patient
          await tx.notification.create({
            data: {
              userId: appointment.patient.user.id,
              title: "Payment Successful",
              message: `Your payment of ${amountFormatted} for your appointment with Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName} has been confirmed.`,
              type: "PAYMENT",
              link: "/patient/payments",
            },
          });

          // Notify doctor
          await tx.notification.create({
            data: {
              userId: appointment.doctor.user.id,
              title: "Appointment Payment Received",
              message: `Payment of ${amountFormatted} received from ${appointment.patient.user.firstName} ${appointment.patient.user.lastName}. Appointment confirmed.`,
              type: "PAYMENT",
              link: "/doctor/billing",
            },
          });
        });
      } catch (error) {
        console.error("Error processing charge.success:", error);
        return NextResponse.json(
          { error: "Error processing webhook" },
          { status: 500 }
        );
      }
      break;
    }

    // ── Failed / reversed charge ─────────────────────────
    case "charge.failed":
    case "transfer.reversed": {
      const charge = event.data;

      try {
        const payment = await prisma.payment.findFirst({
          where: { paystackReference: charge.reference },
          include: {
            patient: {
              include: { user: { select: { id: true } } },
            },
          },
        });

        if (payment) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: "FAILED" },
          });

          await prisma.notification.create({
            data: {
              userId: payment.patient.user.id,
              title: "Payment Failed",
              message: `Your payment of ${formatAmount(charge.amount, charge.currency)} could not be processed. Please try again or use a different payment method.`,
              type: "PAYMENT",
              link: "/patient/payments",
            },
          });
        }
      } catch (error) {
        console.error("Error processing charge.failed:", error);
      }
      break;
    }

    default:
      // Unhandled event type — acknowledge receipt
      break;
  }

  // Always return 200 to acknowledge receipt (Paystack retries on non-200)
  return NextResponse.json({ received: true });
}

// ─── Helpers ─────────────────────────────────────────────

/** Format smallest-currency-unit amount to a human-readable string */
function formatAmount(amountInKobo: number, currency: string): string {
  const decimal = amountInKobo / 100;
  const symbol = currency === "NGN" ? "₦" : currency === "GHS" ? "₵" : "$";
  return `${symbol}${decimal.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

/** Map Paystack channel codes to readable method names */
function formatChannel(channel: string): string {
  const map: Record<string, string> = {
    card: "Card",
    bank: "Bank Transfer",
    ussd: "USSD",
    qr: "QR Code",
    mobile_money: "Mobile Money",
    bank_transfer: "Bank Transfer",
    eft: "EFT",
  };
  return map[channel] ?? channel;
}
