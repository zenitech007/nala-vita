import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// ─── Paystack helpers ─────────────────────────────────────

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_BASE = "https://api.paystack.co";

async function paystackPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok || !data.status) {
    throw new Error(data.message ?? `Paystack error: ${res.status}`);
  }

  return data.data as T;
}

// ─── GET: Return payment history for the current user ────

export async function GET(_req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      include: { patient: true, doctor: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let payments;

    if (user.role === "PATIENT" && user.patient) {
      payments = await prisma.payment.findMany({
        where: { patientId: user.patient.id },
        include: {
          appointment: {
            include: {
              doctor: {
                include: {
                  user: {
                    select: { firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } else if (user.role === "DOCTOR" && user.doctor) {
      payments = await prisma.payment.findMany({
        where: {
          appointment: { doctorId: user.doctor.id },
        },
        include: {
          patient: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          appointment: {
            select: {
              scheduledAt: true,
              consultationType: true,
              doctor: {
                include: {
                  user: {
                    select: { firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      return NextResponse.json(
        { error: "No patient or doctor profile found" },
        { status: 403 }
      );
    }

    return NextResponse.json({ payments });
  } catch (error) {
    console.error("GET /api/payments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── POST: Initialize a Paystack transaction ──────────────
//
// Flow:
//   1. Client calls POST /api/payments with { appointmentId }
//   2. This handler initializes a Paystack transaction and returns
//      { authorizationUrl, reference, amount }
//   3. Client redirects the user to authorizationUrl (Paystack hosted checkout)
//      OR opens the Paystack Popup using the access_code
//   4. Paystack redirects back to callback_url (or fires the webhook)
//   5. Our webhook at /api/payments/webhook confirms the payment

const createPaymentSchema = z.object({
  appointmentId: z.string().min(1, "Appointment ID is required"),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      include: { patient: true },
    });

    if (!user?.patient) {
      return NextResponse.json(
        { error: "Patient profile not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const validated = createPaymentSchema.parse(body);

    // Verify the appointment belongs to this patient
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: validated.appointmentId,
        patientId: user.patient.id,
      },
      include: { payment: true },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    if (appointment.payment?.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Payment already completed" },
        { status: 400 }
      );
    }

    // Paystack amounts are in the smallest currency unit (kobo for NGN, cents for USD)
    const amountDecimal = appointment.payment?.amount ?? 150;
    const currency = (appointment.payment?.currency ?? "NGN").toUpperCase();
    // Paystack uses kobo (NGN×100) just like Stripe uses cents
    const amountInSmallestUnit = Math.round(amountDecimal * 100);

    // Initialize Paystack transaction
    type PaystackInitResponse = {
      authorization_url: string;
      access_code: string;
      reference: string;
    };

    const transaction = await paystackPost<PaystackInitResponse>(
      "/transaction/initialize",
      {
        email: user.email,
        amount: amountInSmallestUnit,
        currency,
        reference: `MC-${appointment.id}-${Date.now()}`,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/patient/payments?status=success`,
        metadata: {
          appointmentId: appointment.id,
          patientId: user.patient.id,
          cancel_action: `${process.env.NEXT_PUBLIC_APP_URL}/patient/payments?status=cancelled`,
        },
      }
    );

    // Persist the Paystack reference so the webhook can look it up
    if (appointment.payment) {
      await prisma.payment.update({
        where: { id: appointment.payment.id },
        data: { paystackReference: transaction.reference },
      });
    } else {
      await prisma.payment.create({
        data: {
          patientId: user.patient.id,
          appointmentId: appointment.id,
          amount: amountDecimal,
          currency,
          status: "PENDING",
          paystackReference: transaction.reference,
        },
      });
    }

    return NextResponse.json({
      authorizationUrl: transaction.authorization_url,
      accessCode: transaction.access_code,
      reference: transaction.reference,
      amount: amountDecimal,
      currency,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("POST /api/payments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
