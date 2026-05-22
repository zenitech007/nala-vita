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
      include: { doctor: true },
    });

    if (!user || user.role !== "DOCTOR" || !user.doctor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));
    const skip = (page - 1) * limit;

    const doctorId = user.doctor.id;

    const patientIds = await prisma.appointment.findMany({
      where: { doctorId },
      select: { patientId: true },
      distinct: ["patientId"],
    });

    const patientIdList = patientIds.map((a) => a.patientId);

    if (patientIdList.length === 0) {
      return NextResponse.json({ patients: [], total: 0, page, limit });
    }

    const searchFilter = search
      ? {
          user: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
            ],
          },
        }
      : {};

    const where = {
      id: { in: patientIdList },
      ...searchFilter,
    };

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              avatarUrl: true,
              email: true,
              phone: true,
            },
          },
          appointments: {
            where: { doctorId },
            orderBy: { scheduledAt: "desc" },
            take: 1,
            select: { scheduledAt: true, status: true },
          },
        },
      }),
      prisma.patient.count({ where }),
    ]);

    const result = patients.map((p) => {
      const lastAppt = p.appointments[0] || null;
      return {
        id: p.id,
        dateOfBirth: p.dateOfBirth,
        gender: p.gender,
        bloodType: p.bloodType,
        allergies: p.allergies,
        user: p.user,
        lastAppointment: lastAppt
          ? { date: lastAppt.scheduledAt, status: lastAppt.status }
          : null,
        totalAppointments: p.appointments.length,
      };
    });

    // Get accurate total appointments count per patient
    const appointmentCounts = await prisma.appointment.groupBy({
      by: ["patientId"],
      where: { doctorId, patientId: { in: patientIdList } },
      _count: { id: true },
    });

    const countMap = new Map(appointmentCounts.map((c) => [c.patientId, c._count.id]));

    const enriched = result.map((p) => ({
      ...p,
      totalAppointments: countMap.get(p.id) || 0,
    }));

    return NextResponse.json({ patients: enriched, total, page, limit });
  } catch (error) {
    console.error("[GET /api/patients]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
