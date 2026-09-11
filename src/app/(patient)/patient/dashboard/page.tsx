// Server Component. Data is fetched on the server before HTML is sent
// to the browser — users see a populated page on first paint.

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import PatientDashboardClient from "./_components/PatientDashboardClient";
import { getAuthenticatedUserWithProfile } from "@/lib/auth-cache";

async function getPatientDashboardData(user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUserWithProfile>>>["user"]) {
  if (!user || !user.patient) return null;
  const patientId = user.patient.id;

  const [appointments, prescriptions, vitals, unreadMessageCount, notifications] =
    await Promise.all([
      prisma.appointment.findMany({
        where: {
          patientId,
          status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
          scheduledAt: { gte: new Date() },
        },
        orderBy: { scheduledAt: "asc" },
        take: 5,
        include: {
          doctor: {
            include: {
              user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            },
          },
        },
      }),
      prisma.prescription.findMany({
        where: { patientId, isActive: true },
        orderBy: { prescribedAt: "desc" },
        take: 5,
      }),
      prisma.vital.findFirst({
        where: { patientId },
        orderBy: { recordedAt: "desc" },
      }),
      prisma.message.count({
        where: { receiverId: user.id, isRead: false },
      }),
      prisma.notification.findMany({
        where: { userId: user.id, isRead: false },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  return {
    user,
    appointments,
    prescriptions,
    vitals,
    unreadMessageCount,
    notifications,
  };
}

export default async function PatientDashboardPage() {
  const authData = await getAuthenticatedUserWithProfile();
  if (!authData?.session || !authData.user) redirect("/login");

  // Fetch all dashboard data on the server
  const data = await getPatientDashboardData(authData.user);
  if (!data) redirect("/login");

  const dashboardData = {
    firstName: data.user.firstName,
    upcomingAppointments: data.appointments,
    activeMedications: data.prescriptions,
    latestVital: data.vitals,
    unreadMessages: data.unreadMessageCount,
    notifications: data.notifications,
  };

  // Hand pre-loaded data to the client component — no loading state needed
  return <PatientDashboardClient data={dashboardData} />;
}
