import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const messagingUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  role: true,
  isActive: true,
  patient: { select: { id: true } },
  doctor: { select: { id: true, specialization: true } },
} satisfies Prisma.UserSelect;

export type MessagingUser = Prisma.UserGetPayload<{
  select: typeof messagingUserSelect;
}>;

export async function getAuthenticatedMessagingUser(): Promise<MessagingUser | null> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: messagingUserSelect,
  });

  return user?.isActive ? user : null;
}

/**
 * Resolve another Prisma user only when the two users have a legitimate
 * doctor-patient relationship. This keeps participant details and attachment
 * uploads from becoming a user-directory lookup.
 */
export async function getAuthorizedMessageParticipant(
  currentUser: MessagingUser,
  otherUserId: string
): Promise<MessagingUser | null> {
  if (!otherUserId || otherUserId === currentUser.id) return null;

  const otherUser = await prisma.user.findUnique({
    where: { id: otherUserId },
    select: messagingUserSelect,
  });

  if (!otherUser?.isActive) return null;

  let appointmentWhere: { patientId: string; doctorId: string } | null = null;

  if (
    currentUser.role === "PATIENT" &&
    currentUser.patient &&
    otherUser.role === "DOCTOR" &&
    otherUser.doctor
  ) {
    appointmentWhere = {
      patientId: currentUser.patient.id,
      doctorId: otherUser.doctor.id,
    };
  } else if (
    currentUser.role === "DOCTOR" &&
    currentUser.doctor &&
    otherUser.role === "PATIENT" &&
    otherUser.patient
  ) {
    appointmentWhere = {
      patientId: otherUser.patient.id,
      doctorId: currentUser.doctor.id,
    };
  }

  if (!appointmentWhere) return null;

  const [appointment, acceptedReferral] = await Promise.all([
    prisma.appointment.findFirst({
      where: appointmentWhere,
      select: { id: true },
    }),
    prisma.referral.findFirst({
      where: {
        patientId: appointmentWhere.patientId,
        status: "ACCEPTED",
        OR: [
          { referringDoctorId: appointmentWhere.doctorId },
          { referredDoctorId: appointmentWhere.doctorId },
        ],
      },
      select: { id: true },
    }),
  ]);

  return appointment || acceptedReferral ? otherUser : null;
}
