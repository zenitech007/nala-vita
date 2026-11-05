import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { paystackMinorUnits } from "@/lib/money";

export class CheckoutError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function initializeCheckout(patientId: string, email: string, appointmentId: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret?.startsWith("sk_test_")) throw new CheckoutError("Test payment configuration is unavailable", 503);
  const attempt = await prisma.$transaction(async tx => {
    const appointment = await tx.appointment.findFirst({ where: { id: appointmentId, patientId }, include: { payment: true } });
    if (!appointment) throw new CheckoutError("Appointment not found", 404);
    if (!appointment.payment || appointment.payment.status !== "PENDING"
      || !["SCHEDULED", "CONFIRMED"].includes(appointment.status)) throw new CheckoutError("No payable quote for this appointment", 409);
    await tx.$queryRaw`SELECT id FROM public.payments WHERE id = ${appointment.payment.id} FOR UPDATE`;
    const payment = await tx.payment.findUnique({ where: { id: appointment.payment.id } });
    if (!payment || payment.status !== "PENDING" || payment.patientId !== patientId || payment.appointmentId !== appointmentId)
      throw new CheckoutError("Payment quote changed", 409);
    const previous = await tx.paymentAttempt.findFirst({ where: { paymentId: payment.id,
      status: { in: ["INITIATING", "INITIALIZED", "INITIALIZATION_UNKNOWN"] } }, orderBy: { createdAt: "desc" } });
    if (previous) {
      if (previous.patientId !== patientId || previous.appointmentId !== appointmentId
        || previous.currency !== payment.currency || previous.amountMinor !== paystackMinorUnits(payment.amount, payment.currency))
        throw new CheckoutError("Existing checkout does not match the current quote", 409);
      return previous;
    }
    return tx.paymentAttempt.create({ data: { paymentId: payment.id, appointmentId, patientId,
      reference: `MC-${randomUUID()}`, amountMinor: paystackMinorUnits(payment.amount, payment.currency),
      currency: payment.currency, domain: "test", status: "INITIATING" } });
  }, { isolationLevel: "ReadCommitted" });

  if (attempt.status === "INITIALIZED" && attempt.authorizationUrl && attempt.accessCode) return checkoutResult(attempt);
  // A previous in-flight/unknown attempt must be reconciled, never silently replaced.
  // A conditional transition elects at most one provider caller for this reference.
  const claimed = await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, status: "INITIATING" }, data: { status: "INITIALIZATION_UNKNOWN" } });
  if (!claimed.count) throw new CheckoutError("Checkout is being processed; wait for reconciliation", 409);
  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ email, amount: Number(attempt.amountMinor), currency: attempt.currency, reference: attempt.reference,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/patient/payments?status=success`,
        metadata: { appointmentId: attempt.appointmentId, patientId: attempt.patientId } }),
    });
    const body = await response.json();
    if (!response.ok || !body.status || body.data?.reference !== attempt.reference
      || typeof body.data.authorization_url !== "string" || typeof body.data.access_code !== "string"
      || new URL(body.data.authorization_url).origin !== "https://checkout.paystack.com") throw new Error("Invalid checkout response");
    const data = { authorizationUrl: body.data.authorization_url as string, accessCode: body.data.access_code as string, status: "INITIALIZED" };
    await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, status: "INITIALIZATION_UNKNOWN" }, data });
    return checkoutResult({ ...attempt, ...data });
  } catch {
    // The durable reference remains available for signed settlement even after a timeout.
    throw new CheckoutError("Checkout could not be confirmed; wait before retrying", 502);
  }
}

function checkoutResult(attempt: { reference: string; authorizationUrl: string | null; accessCode: string | null; amountMinor: bigint; currency: string }) {
  return { reference: attempt.reference, authorizationUrl: attempt.authorizationUrl, accessCode: attempt.accessCode,
    amount: Number(attempt.amountMinor) / 100, currency: attempt.currency };
}
