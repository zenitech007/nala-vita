import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

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

// ─── POST: Create a Stripe PaymentIntent ─────────────────

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

    // Verify appointment belongs to this patient and has a pending payment
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

    const amount = appointment.payment?.amount ?? 150; // Default consultation fee

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe expects cents
      currency: "usd",
      metadata: {
        appointmentId: appointment.id,
        patientId: user.patient.id,
      },
    });

    // Update or create payment record with Stripe ID
    if (appointment.payment) {
      await prisma.payment.update({
        where: { id: appointment.payment.id },
        data: { stripePaymentId: paymentIntent.id },
      });
    } else {
      await prisma.payment.create({
        data: {
          patientId: user.patient.id,
          appointmentId: appointment.id,
          amount,
          currency: "usd",
          status: "PENDING",
          stripePaymentId: paymentIntent.id,
        },
      });
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount,
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
