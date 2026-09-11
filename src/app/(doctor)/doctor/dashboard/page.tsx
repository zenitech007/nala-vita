import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DoctorDashboardClient from "./_components/DoctorDashboardClient";
import { getAuthenticatedUserWithProfile } from "@/lib/auth-cache";

export default async function DoctorDashboardPage() {
  const authData = await getAuthenticatedUserWithProfile();
  if (!authData?.session || !authData.user?.doctor) redirect("/login");

  const { user } = authData;
  const doctorId = authData.user.doctor.id;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    todaysAppointments,
    pendingLabOrders,
    unreadMessages,
    recentPrescriptions,
    totalPatients,
    revenueThisWeekResult,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        doctorId,
        scheduledAt: { gte: todayStart, lt: todayEnd },
        status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        patient: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),

    prisma.labOrder.count({
      where: {
        doctorId,
        results: { none: {} },
      },
    }),

    prisma.message.count({
      where: { receiverId: user.id, isRead: false },
    }),

    prisma.prescription.findMany({
      where: { doctorId },
      orderBy: { prescribedAt: "desc" },
      take: 3,
      include: {
        patient: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),

    prisma.appointment.groupBy({
      by: ["patientId"],
      where: { doctorId },
    }).then((groups) => groups.length),

    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: "COMPLETED",
        paidAt: { gte: weekStart },
        appointment: { doctorId },
      },
    }),
  ]);

  const patientIds = todaysAppointments.map((a) => a.patientId);
  const abnormalVitalsRaw = patientIds.length > 0
    ? await prisma.vital.findMany({
        where: {
          patientId: { in: patientIds },
          recordedAt: { gte: twentyFourHoursAgo },
          OR: [
            { heartRate: { gt: 100 } },
            { heartRate: { lt: 50 } },
            { temperature: { gt: 38.5 } },
            { oxygenSaturation: { lt: 92 } },
            { bloodSugar: { gt: 180 } },
            { bloodSugar: { lt: 70 } },
          ],
        },
        include: {
          patient: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
        orderBy: { recordedAt: "desc" },
        take: 5,
      })
    : [];

  const abnormalVitals = abnormalVitalsRaw.map((v) => {
    let metric = "Vital";
    let value = "";
    let severity: "warning" | "critical" = "warning";

    if (v.heartRate && (v.heartRate > 100 || v.heartRate < 50)) {
      metric = "Heart Rate";
      value = `${v.heartRate} bpm`;
      severity = v.heartRate > 120 || v.heartRate < 40 ? "critical" : "warning";
    } else if (v.temperature && v.temperature > 38.5) {
      metric = "Temperature";
      value = `${v.temperature}°C`;
      severity = v.temperature > 39.5 ? "critical" : "warning";
    } else if (v.oxygenSaturation && v.oxygenSaturation < 92) {
      metric = "SpO2";
      value = `${v.oxygenSaturation}%`;
      severity = v.oxygenSaturation < 88 ? "critical" : "warning";
    } else if (v.bloodSugar && (v.bloodSugar > 180 || v.bloodSugar < 70)) {
      metric = "Blood Sugar";
      value = `${v.bloodSugar} mg/dL`;
      severity = v.bloodSugar > 250 || v.bloodSugar < 54 ? "critical" : "warning";
    }

    const diffMs = now.getTime() - new Date(v.recordedAt).getTime();
    const hours = Math.floor(diffMs / 3600000);
    const recordedAt = hours < 1 ? "Just now" : `${hours} hour${hours > 1 ? "s" : ""} ago`;

    return {
      id: v.id,
      patientName: `${v.patient.user.firstName} ${v.patient.user.lastName}`,
      metric,
      value,
      severity,
      recordedAt,
    };
  });

  const dashboardData = {
    firstName: user.firstName,
    todaysAppointments: todaysAppointments.map((a) => ({
      id: a.id,
      scheduledAt: a.scheduledAt.toISOString(),
      consultationType: a.consultationType,
      urgencyLevel: a.urgencyLevel,
      reason: a.reason,
      status: a.status,
      patient: a.patient,
    })),
    abnormalVitals,
    pendingLabOrders,
    unreadMessages,
    recentPrescriptions: recentPrescriptions.map((p) => ({
      id: p.id,
      medication: p.medication,
      dosage: p.dosage,
      prescribedAt: p.prescribedAt.toISOString(),
      patient: p.patient,
    })),
    totalPatients,
    revenueThisWeek: revenueThisWeekResult._sum.amount ?? 0,
  };

  return <DoctorDashboardClient data={dashboardData} />;
}
