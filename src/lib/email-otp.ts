import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { OtpChallenge, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { selectOtpChannel, type OtpChannel } from "@/lib/otp-channel";
import { checkRateLimitAsync } from "@/lib/rate-limit";

export function otpDigest(value: string): string {
  const secret = process.env.OTP_HASH_SECRET;
  if (!secret || secret.length < 32) throw new Error("OTP hashing is not configured");
  return createHmac("sha256", secret).update(value).digest("hex");
}
export const normalizeEmail = (value: string) => value.trim().toLowerCase();
interface IssueInput {
  email: string; ip: string; purpose: string; targetUserId: string | null; binding: string;
  verifiedEmail: boolean; context?: Prisma.InputJsonValue;
}
export async function issueEmailOtp(input: IssueInput, injectedChannel?: OtpChannel): Promise<{ challengeId: string }> {
  const now = new Date(), challengeId = randomUUID(), email = normalizeEmail(input.email);
  const recipientHash = otpDigest(`email:${email}`), ipHash = otpDigest(`ip:${input.ip}`);
  const budget = await checkRateLimitAsync(`otp:send:${ipHash}`, { maxRequests: 20, windowMs: 3_600_000 });
  if (!budget.allowed) return { challengeId };
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const stored = await prisma.$transaction(async tx => {
    for (const key of [`otp:email:${recipientHash}`, `otp:ip:${ipHash}`].sort())
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
    const hour = new Date(now.getTime() - 3600000);
    const recent = await tx.otpChallenge.findFirst({ where: { recipientHash, createdAt: { gte: new Date(now.getTime() - 60000) } } });
    const emailCount = await tx.otpChallenge.count({ where: { recipientHash, createdAt: { gte: hour } } });
    const ipCount = await tx.otpChallenge.count({ where: { ipHash, createdAt: { gte: hour } } });
    if (recent || emailCount >= 5 || ipCount >= 20) return false;
    await tx.otpChallenge.create({ data: { id: challengeId, recipientHash, ipHash, purpose: input.purpose,
      targetUserId: input.targetUserId, bindingHash: otpDigest(`binding:${input.binding}`),
      codeHash: otpDigest(`code:${challengeId}:${input.purpose}:${input.binding}:${code}`),
      expiresAt: new Date(now.getTime() + 600000), context: input.context ?? {} } });
    return true;
  }, { isolationLevel: "ReadCommitted" });
  if (stored && input.targetUserId && input.verifiedEmail) {
    try { await (injectedChannel ?? selectOtpChannel({ email, verifiedEmail: true })).send(email, code, input.purpose); }
    catch { console.error("OTP email delivery failed; check configured transport"); }
  }
  // Nonexistent and rate-limited requests have the same body/status and an opaque ID.
  return { challengeId };
}

export async function consumeEmailOtp<T = boolean>(
  proof: { challengeId: string; code: string; purpose: string; binding: string; ip?: string },
  action?: (tx: Prisma.TransactionClient, challenge: OtpChallenge) => Promise<T>
): Promise<T | false> {
  const budgetId = otpDigest(`verify-ip:${proof.ip ?? "unknown"}`);
  const limit = await checkRateLimitAsync(`otp:verify:${budgetId}`, { maxRequests: 30, windowMs: 60_000 });
  if (!limit.allowed) return false;
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${budgetId}, 0))::text`;
    const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000);
    const budget = await tx.otpVerificationBudget.findUnique({ where: { id: budgetId } });
    const current = budget?.windowStart.getTime() === windowStart.getTime();
    if (current && budget.count >= 30) return false;
    await tx.otpVerificationBudget.upsert({ where: { id: budgetId },
      create: { id: budgetId, windowStart, count: 1 }, update: { windowStart, count: current ? budget.count + 1 : 1 } });
    await tx.$queryRaw`SELECT id FROM public.otp_challenges WHERE id = ${proof.challengeId} FOR UPDATE`;
    const row = await tx.otpChallenge.findUnique({ where: { id: proof.challengeId } });
    if (!row || row.consumedAt || row.attempts >= 5 || row.expiresAt <= new Date()) return false;
    const expected = otpDigest(`code:${row.id}:${proof.purpose}:${proof.binding}:${proof.code}`);
    const valid = /^\d{6}$/.test(proof.code) && row.purpose === proof.purpose
      && row.bindingHash === otpDigest(`binding:${proof.binding}`)
      && timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(row.codeHash, "hex"));
    if (!valid) { await tx.otpChallenge.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } }); return false; }
    const consumed = await tx.otpChallenge.updateMany({ where: { id: row.id, consumedAt: null, attempts: { lt: 5 }, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
    if (consumed.count !== 1) return false;
    return action ? action(tx, row) : true as T;
  }, { isolationLevel: "ReadCommitted", timeout: 20000 });
}
