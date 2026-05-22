// ✅ No "use client" — this is a Server Component.
// Data is fetched on the server before HTML is sent to the browser.
// Users see a populated page on first paint, not a loading skeleton.

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import PatientDashboardClient from "./_components/PatientDashboardClient";

async function getPatientDashboardData(supabaseUserId: string) {
  // Find the user + patient record
  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUserId },
    include: {
      patient: {
        include: {
          // Upcoming appointments (next 5)
          appointments: {
            where: {
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
          },
          // Active prescriptions
          prescriptions: {
            where: { isActive: true },
            orderBy: { prescribedAt: "desc" },
            take: 5,
          },
          // Latest vitals (most recent reading)
          vitals: {
            orderBy: { recordedAt: "desc" },
            take: 1,
          },
        },
      },
      // Unread message count
      receivedMessages: {
        where: { isRead: false },
        select: { id: true },
      },
      // Unread notifications
      notifications: {
        where: { isRead: false },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  return user;
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
  const user = await getPatientDashboardData(session.user.id);
  if (!user || !user.patient) redirect("/login");

  const dashboardData = {
    firstName: user.firstName,
    upcomingAppointments: user.patient.appointments,
    activeMedications: user.patient.prescriptions,
    latestVital: user.patient.vitals[0] ?? null,
    unreadMessages: user.receivedMessages.length,
    notifications: user.notifications,
  };

  // Hand pre-loaded data to the client component — no loading state needed
  return <PatientDashboardClient data={dashboardData} />;
}