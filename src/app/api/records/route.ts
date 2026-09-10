import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(_req: NextRequest) {
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
      include: { patient: true },
    });

    if (!user || !user.patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const patientId = user.patient.id;

    const [medicalNotes, labOrders, prescriptions, vitals, referrals] =
      await Promise.all([
        prisma.medicalNote.findMany({
          where: { patientId },
          orderBy: { createdAt: "desc" },
          include: {
            doctor: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        }),
        prisma.labOrder.findMany({
          where: { patientId },
          orderBy: { orderedAt: "desc" },
          include: {
            results: true,
            doctor: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        }),
        prisma.prescription.findMany({
          where: { patientId },
          orderBy: { prescribedAt: "desc" },
          include: {
            doctor: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        }),
        prisma.vital.findMany({
          where: { patientId },
          orderBy: { recordedAt: "desc" },
        }),
        prisma.referral.findMany({
          where: { patientId },
          orderBy: { createdAt: "desc" },
          include: {
            referringDoctor: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
            referredDoctor: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        }),
      ]);

    const latestVitals: Record<string, unknown> = {};
    const vitalKeys = [
      "bloodPressure",
      "heartRate",
      "temperature",
      "oxygenSaturation",
      "weight",
      "bloodSugar",
    ] as const;

    for (const key of vitalKeys) {
      const reading = vitals.find((v) => v[key] != null);
      if (reading) {
        latestVitals[key] = {
          value: reading[key],
          recordedAt: reading.recordedAt,
        };
      }
    }

    return NextResponse.json({
      medicalNotes,
      labOrders,
      prescriptions,
      vitals: latestVitals,
      allVitals: vitals,
      referrals,
    });
  } catch (error) {
    console.error("[GET /api/records]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
