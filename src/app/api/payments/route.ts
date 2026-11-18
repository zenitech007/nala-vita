import { parsePagination, cursorWhere, pageResult, PaginationError } from "@/lib/pagination";
import { requireApiUser } from '@/lib/auth';
import { CheckoutError, initializeCheckout } from '@/lib/payment-checkout';
import { moneyForJson } from '@/lib/money';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// ─── GET: Return payment history for the current user ────

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR"] });
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const { limit, cursor } = parsePagination(new URL(req.url).searchParams);
    let payments;

    if (user.role === "PATIENT" && user.patient) {
      payments = await prisma.payment.findMany({
        where: { AND: [{ patientId: user.patient!.id }, cursorWhere(cursor, "createdAt")] },
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
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });
    } else if (user.role === "DOCTOR" && user.doctor) {
      payments = await prisma.payment.findMany({
        where: {
          AND: [{ appointment: { doctorId: user.doctor!.id } }, cursorWhere(cursor, "createdAt")],
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
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });
    } else {
      return NextResponse.json(
        { error: "No patient or doctor profile found" },
        { status: 403 }
      );
    }

    const page = pageResult<(typeof payments)[number]>(payments, limit, "createdAt");
    return NextResponse.json(moneyForJson({ payments: page.items, nextCursor: page.nextCursor }));
  } catch (error) {
    if (error instanceof PaginationError) return NextResponse.json({ error: error.message }, { status: 400 });
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
    if (!auth.user.email) return NextResponse.json({ error: "A verified email is required for checkout" }, { status: 409 });
    const checkout = await initializeCheckout(auth.user.patient!.id, auth.user.email, appointmentId, req.signal);
    return NextResponse.json(checkout);
  } catch (error) {
    if (error instanceof CheckoutError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid checkout request", details: error.issues }, { status: 422 });
    return NextResponse.json({ error: "Checkout unavailable" }, { status: 500 });
  }
}
