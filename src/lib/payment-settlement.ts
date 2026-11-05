import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { paystackMinorUnits } from "@/lib/money";

export const chargeSuccessSchema = z.object({
  event: z.literal("charge.success"),
  data: z.object({
    id: z.union([z.number().int().positive().safe(), z.string().regex(/^\d+$/)]).transform(String),
    domain: z.literal("test"), reference: z.string().min(1), amount: z.number().int().positive().safe(),
    currency: z.string().regex(/^[A-Z]{3}$/), status: z.literal("success"),
    channel: z.string().max(100), paid_at: z.string().datetime(),
    metadata: z.object({ appointmentId: z.string().min(1), patientId: z.string().min(1) }),
  }),
});

export class SettlementError extends Error {}

export async function settleCharge(event: z.infer<typeof chargeSuccessSchema>) {
  const charge = event.data;
  // Paystack's signed charge payload identifies the resource, not a separate delivery.
  // Resource ID + event type + domain is stable across retries and dashboard resends.
  const providerEventId = `paystack:test:${event.event}:${charge.id}`;
  return prisma.$transaction(async tx => {
    const initial = await tx.paymentAttempt.findUnique({ where: { reference: charge.reference } });
    if (!initial) throw new SettlementError("Unknown payment reference");
    await tx.$queryRaw`SELECT id FROM public.payments WHERE id = ${initial.paymentId} FOR UPDATE`;
    const attempt = await tx.paymentAttempt.findUnique({ where: { id: initial.id }, include: {
      payment: { include: { appointment: { include: { patient: { select: { userId: true } }, doctor: { select: { userId: true } } } } } },
    } });
    if (!attempt) throw new SettlementError("Unknown payment reference");
    const payment = attempt.payment, appointment = payment.appointment;
    if (attempt.domain !== "test" || attempt.reference !== charge.reference || attempt.amountMinor !== BigInt(charge.amount)
      || attempt.currency !== charge.currency || attempt.patientId !== charge.metadata.patientId || attempt.appointmentId !== charge.metadata.appointmentId
      || payment.patientId !== attempt.patientId || payment.appointmentId !== attempt.appointmentId
      || appointment.patientId !== attempt.patientId || appointment.id !== attempt.appointmentId
      || payment.currency !== attempt.currency || paystackMinorUnits(payment.amount, payment.currency) !== attempt.amountMinor
      || (attempt.providerTransactionId && attempt.providerTransactionId !== charge.id)) throw new SettlementError("Charge does not match the stored quote");

    const receipt = await tx.paymentProviderEvent.findUnique({ where: { providerEventId } });
    if (receipt) {
      if (receipt.attemptId !== attempt.id) throw new SettlementError("Provider event is bound to another attempt");
      return receipt.outcome;
    }
    const pendingAttempt = ["INITIATING", "INITIALIZATION_UNKNOWN", "INITIALIZED"].includes(attempt.status);
    if (payment.status !== "PENDING" || !["SCHEDULED", "CONFIRMED"].includes(appointment.status) || !pendingAttempt) {
      const outcome = payment.status === "COMPLETED" && attempt.status === "SUCCEEDED" ? "ALREADY_SETTLED" : "REQUIRES_RECONCILIATION";
      await tx.paymentProviderEvent.create({ data: { providerEventId, providerTransactionId: charge.id, attemptId: attempt.id, type: event.event, outcome } });
      if (pendingAttempt) await tx.paymentAttempt.updateMany({ where: { id: attempt.id, status: { in: ["INITIATING", "INITIALIZATION_UNKNOWN", "INITIALIZED"] } }, data: { status: "REQUIRES_RECONCILIATION" } });
      return outcome;
    }
    await tx.paymentProviderEvent.create({ data: { providerEventId, providerTransactionId: charge.id, attemptId: attempt.id, type: event.event, outcome: "APPLIED" } });
    const updated = await tx.payment.updateMany({ where: { id: payment.id, patientId: attempt.patientId, appointmentId: attempt.appointmentId,
      amount: payment.amount, currency: attempt.currency, status: "PENDING" },
      data: { status: "COMPLETED", method: charge.channel, paidAt: new Date(charge.paid_at) } });
    const confirmed = await tx.appointment.updateMany({ where: { id: appointment.id, patientId: attempt.patientId, status: { in: ["SCHEDULED", "CONFIRMED"] } }, data: { status: "CONFIRMED" } });
    const completed = await tx.paymentAttempt.updateMany({ where: { id: attempt.id, status: { in: ["INITIATING", "INITIALIZATION_UNKNOWN", "INITIALIZED"] } },
      data: { status: "SUCCEEDED", providerTransactionId: charge.id } });
    if (updated.count !== 1 || confirmed.count !== 1 || completed.count !== 1) throw new Error("Settlement lost a conditional update; transaction must roll back");
    await tx.notification.create({ data: { userId: appointment.patient.userId, title: "Payment Successful", message: "Your appointment payment has been confirmed.", type: "PAYMENT", link: "/patient/payments" } });
    await tx.notification.create({ data: { userId: appointment.doctor.userId, title: "Appointment Payment Received", message: "Payment for your appointment has been confirmed.", type: "PAYMENT", link: "/doctor/billing" } });
    return "APPLIED";
  }, { isolationLevel: "ReadCommitted" });
}
