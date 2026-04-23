import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    );
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { appointmentId, patientId } = paymentIntent.metadata;

      if (!appointmentId || !patientId) {
        console.error("Missing metadata on payment_intent:", paymentIntent.id);
        break;
      }

      try {
        await prisma.$transaction(async (tx) => {
          // Update payment status
          const payment = await tx.payment.findFirst({
            where: { stripePaymentId: paymentIntent.id },
          });

          if (payment) {
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: "COMPLETED",
                method: paymentIntent.payment_method_types?.[0] || "card",
                paidAt: new Date(),
              },
            });
          }

          // Confirm the appointment
          await tx.appointment.update({
            where: { id: appointmentId },
            data: { status: "CONFIRMED" },
          });

          // Get appointment details for notifications
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

          const amountFormatted = `$${(paymentIntent.amount / 100).toFixed(2)}`;

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
        console.error("Error processing payment_intent.succeeded:", error);
        return NextResponse.json(
          { error: "Error processing webhook" },
          { status: 500 }
        );
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      try {
        const payment = await prisma.payment.findFirst({
          where: { stripePaymentId: paymentIntent.id },
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
              message: `Your payment of $${payment.amount.toFixed(2)} could not be processed. Please try again or use a different payment method.`,
              type: "PAYMENT",
              link: "/patient/payments",
            },
          });
        }
      } catch (error) {
        console.error("Error processing payment_intent.payment_failed:", error);
      }
      break;
    }

    default:
      // Unhandled event type
      break;
  }

  return NextResponse.json({ received: true });
}
