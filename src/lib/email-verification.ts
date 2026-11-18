import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { consumeEmailOtp, issueEmailOtp, normalizeEmail } from "@/lib/email-otp";
const binding = (userId: string | null, email: string) => `verify-email:${userId ?? "none"}:${normalizeEmail(email)}`;

export async function requestEmailVerification(emailInput: string, ip: string) {
  const email = normalizeEmail(emailInput);
  const matches = await prisma.user.findMany({ where: { email: { equals: email, mode: "insensitive" } }, take: 2 });
  const user = matches.length === 1 ? matches[0] : null;
  const target = user?.supabaseId && user.isActive && !user.emailVerified ? user.id : null;
  return issueEmailOtp({ email, ip, purpose: "VERIFY_EMAIL", targetUserId: target, verifiedEmail: target !== null, binding: binding(target, email) });
}
export async function completeEmailVerification(input: { challengeId: string; code: string; email: string; ip: string }) {
  const email = normalizeEmail(input.email);
  const challenge = await prisma.otpChallenge.findUnique({ where: { id: input.challengeId } });
  if (!challenge?.targetUserId) return false;
  return consumeEmailOtp({ ...input, purpose: "VERIFY_EMAIL", binding: binding(challenge.targetUserId, email) }, async (tx, proof) => {
    await tx.$queryRaw`SELECT id FROM public.users WHERE id = ${proof.targetUserId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: proof.targetUserId! } });
    if (!user?.supabaseId || !user.isActive || !user.email || normalizeEmail(user.email) !== email) return false;
    const identity = await supabaseAdmin.auth.admin.getUserById(user.supabaseId);
    if (identity.error || !identity.data.user?.email || normalizeEmail(identity.data.user.email) !== email) return false;
    const result = await supabaseAdmin.auth.admin.updateUserById(user.supabaseId, { email_confirm: true });
    if (result.error) throw new Error("Email confirmation could not finish");
    const updated = await tx.user.updateMany({ where: { id: user.id, supabaseId: user.supabaseId, email: user.email, isActive: true }, data: { emailVerified: true } });
    if (updated.count !== 1) throw new Error("Email confirmation lost a conditional update");
    return true;
  });
}
