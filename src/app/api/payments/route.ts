import { requireApiUser } from '@/lib/auth';
import { CheckoutError, initializeCheckout } from '@/lib/payment-checkout';
import { moneyForJson } from '@/lib/money';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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

    return NextResponse.json(moneyForJson({ payments }));
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
  const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
  if (!auth.ok) return auth.response;
  try {
    const { appointmentId } = createPaymentSchema.parse(await req.json());
    const checkout = await initializeCheckout(auth.user.patient!.id, auth.user.email, appointmentId);
    return NextResponse.json(checkout);
  } catch (error) {
    if (error instanceof CheckoutError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid checkout request", details: error.issues }, { status: 422 });
    return NextResponse.json({ error: "Checkout unavailable" }, { status: 500 });
  }
}
