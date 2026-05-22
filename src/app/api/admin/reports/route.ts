import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const dateFilter = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
    const hasDateFilter = from || to;

    const [
      totalPatients,
      totalDoctors,
      totalAppointments,
      totalRevenueResult,
      appointmentsThisMonth,
      revenueThisMonthResult,
      appointmentsByStatus,
      appointmentsByType,
      revenueByMonth,
      topDoctorsRaw,
      recentPayments,
      recentAppointments,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.doctor.count(),
      prisma.appointment.count(hasDateFilter ? { where: { scheduledAt: dateFilter } } : undefined),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: "COMPLETED",
          ...(hasDateFilter ? { paidAt: dateFilter } : {}),
        },
      }),
      prisma.appointment.count({
        where: { scheduledAt: { gte: startOfMonth } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: "COMPLETED", paidAt: { gte: startOfMonth } },
      }),
      prisma.appointment.groupBy({
        by: ["status"],
        _count: { id: true },
        ...(hasDateFilter ? { where: { scheduledAt: dateFilter } } : {}),
      }),
      prisma.appointment.groupBy({
        by: ["consultationType"],
        _count: { id: true },
        ...(hasDateFilter ? { where: { scheduledAt: dateFilter } } : {}),
      }),
      prisma.$queryRawUnsafe<{ month: string; total: number }[]>(
        `SELECT to_char(paid_at, 'YYYY-MM') as month, SUM(amount)::float as total
         FROM payments
         WHERE status = 'COMPLETED' AND paid_at IS NOT NULL
         GROUP BY to_char(paid_at, 'YYYY-MM')
         ORDER BY month DESC
         LIMIT 12`
      ),
      prisma.appointment.groupBy({
        by: ["doctorId"],
        _count: { patientId: true },
        orderBy: { _count: { patientId: "desc" } },
        take: 5,
      }),
      prisma.payment.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          patient: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.appointment.findMany({
        take: 10,
        orderBy: { scheduledAt: "desc" },
        include: {
          patient: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          doctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);

    const doctorIds = topDoctorsRaw.map((d) => d.doctorId);
    const doctors = await prisma.doctor.findMany({
      where: { id: { in: doctorIds } },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const doctorMap = new Map(doctors.map((d) => [d.id, d]));

    const topDoctors = topDoctorsRaw.map((d) => {
      const doc = doctorMap.get(d.doctorId);
      return {
        doctorId: d.doctorId,
        name: doc ? `${doc.user.firstName} ${doc.user.lastName}` : "Unknown",
        totalPatients: d._count.patientId,
        rating: doc?.rating ?? 0,
      };
    });

    return NextResponse.json({
      overview: {
        totalPatients,
        totalDoctors,
        totalAppointments,
        totalRevenue: totalRevenueResult._sum.amount ?? 0,
        appointmentsThisMonth,
        revenueThisMonth: revenueThisMonthResult._sum.amount ?? 0,
      },
      appointmentsByStatus: appointmentsByStatus.map((a) => ({
        status: a.status,
        count: a._count.id,
      })),
      appointmentsByType: appointmentsByType.map((a) => ({
        consultationType: a.consultationType,
        count: a._count.id,
      })),
      revenueByMonth,
      topDoctors,
      recentPayments,
      recentAppointments,
      topConditions: [],
    });
  } catch (error) {
    console.error("[GET /api/admin/reports]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
