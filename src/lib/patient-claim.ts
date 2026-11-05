import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { consumeEmailOtp, issueEmailOtp, normalizeEmail, otpDigest } from "@/lib/email-otp";

const claimBinding = (target: string | null, email: string, invitationId: string | null) =>
  `claim:${target ?? "none"}:${normalizeEmail(email)}:${invitationId ?? "none"}`;

export async function requestPatientClaim(emailInput: string, ip: string, invitationCode?: string) {
  const email = normalizeEmail(emailInput);
  let targetUserId: string | null = null, invitationId: string | null = null;
  if (invitationCode) {
    const invitation = await prisma.claimInvitation.findUnique({ where: { tokenHash: otpDigest(`invite:${invitationCode}`) } });
    if (invitation && !invitation.usedAt && invitation.expiresAt > new Date()) {
      const patient = await prisma.patient.findUnique({ where: { id: invitation.patientId }, include: { user: true } });
      const issuer = await prisma.doctor.findUnique({ where: { id: invitation.issuerDoctorId }, include: { user: true } });
      if (patient && patient.createdByDoctorId === invitation.issuerDoctorId && patient.user.supabaseId === null
        && patient.user.isActive && patient.user.role === "PATIENT" && issuer?.isVerified && issuer.user.isActive) {
        targetUserId = patient.userId; invitationId = invitation.id;
      }
    }
  } else {
    // Fail closed on case-variant duplicates, rather than picking one person's record.
    const matches = await prisma.user.findMany({ where: { email: { equals: email, mode: "insensitive" }, role: "PATIENT" }, include: { patient: true }, take: 2 });
    const candidate = matches.length === 1 ? matches[0] : null;
    if (candidate?.patient && candidate.isActive && candidate.supabaseId === null) targetUserId = candidate.id;
  }
  // A claim challenge proves control of the email on file (or the invitation's new email).
  // It does not mark the contact verified until the code is consumed successfully.
  return issueEmailOtp({ email, ip, purpose: "CLAIM", targetUserId, verifiedEmail: targetUserId !== null,
    binding: claimBinding(targetUserId, email, invitationId), context: { invitationId } });
}

export async function completePatientClaim(input: { challengeId: string; code: string; email: string; password: string; ip?: string }) {
  const email = normalizeEmail(input.email);
  const challenge = await prisma.otpChallenge.findUnique({ where: { id: input.challengeId } });
  if (!challenge || !challenge.targetUserId) return false;
  const context = challenge.context as { invitationId?: string | null };
  const invitationId = context.invitationId ?? null;
  let createdAuthId: string | null = null;
  try {
    return await consumeEmailOtp({ ...input, purpose: "CLAIM", binding: claimBinding(challenge.targetUserId, email, invitationId) }, async (tx, proof) => {
      await tx.$queryRaw`SELECT id FROM public.users WHERE id = ${proof.targetUserId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: proof.targetUserId! }, include: { patient: true } });
      if (!user?.patient || user.supabaseId !== null || user.role !== "PATIENT" || !user.isActive
        || proof.recipientHash !== otpDigest(`email:${email}`)) return false;
      if (invitationId) {
        await tx.$queryRaw`SELECT id FROM public.claim_invitations WHERE id = ${invitationId} FOR UPDATE`;
        const invitation = await tx.claimInvitation.findUnique({ where: { id: invitationId } });
        if (!invitation || invitation.patientId !== user.patient.id || invitation.issuerDoctorId !== user.patient.createdByDoctorId
          || invitation.usedAt || invitation.expiresAt <= new Date()) return false;
        const issuer = await tx.doctor.findUnique({ where: { id: invitation.issuerDoctorId }, include: { user: true } });
        if (!issuer?.isVerified || !issuer.user.isActive) return false;
        const used = await tx.claimInvitation.updateMany({ where: { id: invitationId, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
        if (used.count !== 1) return false;
      } else if (!user.email || normalizeEmail(user.email) !== email) return false;

      // Proof was checked before confirming an email. The row lock serializes claims.
      const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password: input.password,
        email_confirm: true, user_metadata: { first_name: user.firstName, last_name: user.lastName, role: "PATIENT" } });
      if (error || !data.user) throw new Error("Account could not be created");
      createdAuthId = data.user.id;
      const bound = await tx.user.updateMany({ where: { id: user.id, supabaseId: null, role: "PATIENT", isActive: true },
        data: { supabaseId: data.user.id, email, emailVerified: true } });
      if (bound.count !== 1) throw new Error("Record claim lost a conditional update");
      return true;
    });
  } catch (error) {
    if (createdAuthId) {
      const deleted = await supabaseAdmin.auth.admin.deleteUser(createdAuthId);
      if (deleted.error) throw new Error("Auth compensation failed; account reconciliation required");
    }
    throw error;
  }
}
