import { requireApiUser } from "@/lib/auth";
import { getRecordVisibility } from "@/lib/record-visibility";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(_req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const patientId = user.patient!.id;
    const access = await getRecordVisibility(user, patientId);

    const [medicalNotes, labOrders, prescriptions, vitals, referrals] =
      await Promise.all([
        prisma.medicalNote.findMany({
          where: access.where("NOTES"),
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
          where: access.where("LAB_TESTS"),
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
          where: access.where("PRESCRIPTIONS"),
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
          where: access.where("VITALS"),
          orderBy: { recordedAt: "desc" },
        }),
        prisma.referral.findMany({
          where: access.where("REFERRALS"),
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
          ...(key === "temperature" ? { unit: "C", originalValue: reading.temperatureOriginal, originalUnit: reading.temperatureOriginalUnit } : {}),
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
