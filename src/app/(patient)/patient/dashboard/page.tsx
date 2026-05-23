// Server Component. Data is fetched on the server before HTML is sent
// to the browser — users see a populated page on first paint.

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import PatientDashboardClient from "./_components/PatientDashboardClient";

async function getPatientDashboardData(supabaseUserId: string) {
  // Performance: previously this was one Prisma query with deep nested
  // includes, which generates 5-6 sequential SQL round-trips. With the DB
  // in another continent each round-trip costs 200-300ms. We now:
  //   1. Look up the user+patient (1 RTT, needed for the patient.id)
  //   2. Fire every dependent fetch in parallel (1 RTT total)
  // Total: ~2 RTT instead of ~6.
  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUserId },
    include: { patient: { select: { id: true } } },
  });

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
  // Read session from cookie — no network call
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // Fetch all dashboard data on the server
  const data = await getPatientDashboardData(session.user.id);
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
