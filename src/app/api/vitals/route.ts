import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// ─── Reference ranges for anomaly detection ──────────────

const REFERENCE_RANGES = {
  heartRate: { min: 60, max: 100, label: "Heart Rate" },
  temperature: { min: 97, max: 99.5, label: "Temperature" },
  oxygenSaturation: { min: 95, max: 100, label: "SpO2" },
  bloodSugar: { min: 70, max: 140, label: "Blood Sugar" },
  respiratoryRate: { min: 12, max: 20, label: "Respiratory Rate" },
  weight: { min: 30, max: 200, label: "Weight" },
  systolic: { min: 90, max: 140, label: "Systolic BP" },
  diastolic: { min: 60, max: 90, label: "Diastolic BP" },
};

function checkAnomalies(data: Record<string, unknown>): string[] {
  const alerts: string[] = [];

  if (data.bloodPressure && typeof data.bloodPressure === "string") {
    const [sys, dia] = data.bloodPressure.split("/").map(Number);
    if (sys && (sys < REFERENCE_RANGES.systolic.min || sys > REFERENCE_RANGES.systolic.max)) {
      alerts.push(`Systolic BP ${sys} mmHg is outside normal range (${REFERENCE_RANGES.systolic.min}-${REFERENCE_RANGES.systolic.max})`);
    }
    if (dia && (dia < REFERENCE_RANGES.diastolic.min || dia > REFERENCE_RANGES.diastolic.max)) {
      alerts.push(`Diastolic BP ${dia} mmHg is outside normal range (${REFERENCE_RANGES.diastolic.min}-${REFERENCE_RANGES.diastolic.max})`);
    }
  }

  const numericChecks: { field: string; ref: keyof typeof REFERENCE_RANGES }[] = [
    { field: "heartRate", ref: "heartRate" },
    { field: "temperature", ref: "temperature" },
    { field: "oxygenSaturation", ref: "oxygenSaturation" },
    { field: "bloodSugar", ref: "bloodSugar" },
    { field: "respiratoryRate", ref: "respiratoryRate" },
  ];

  for (const { field, ref } of numericChecks) {
    const val = data[field];
    if (typeof val === "number") {
      const range = REFERENCE_RANGES[ref];
      if (val < range.min || val > range.max) {
        alerts.push(`${range.label} ${val} is outside normal range (${range.min}-${range.max})`);
      }
    }
  }

  return alerts;
}

// ─── GET: Return vitals for a patient ────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      include: { patient: true, doctor: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "30");
    const patientIdParam = searchParams.get("patientId");

    // Determine patient ID
    let patientId: string | undefined;
    if (user.role === "PATIENT" && user.patient) {
      patientId = user.patient.id;
    } else if (patientIdParam) {
      patientId = patientIdParam;
    }

    if (!patientId) {
      // Doctor requesting all monitored patients' latest vitals
      if (user.role === "DOCTOR" && user.doctor) {
        const patients = await prisma.patient.findMany({
          where: {
            appointments: {
              some: { doctorId: user.doctor.id },
            },
          },
          include: {
            user: { select: { firstName: true, lastName: true } },
            vitals: { orderBy: { recordedAt: "desc" }, take: 1 },
          },
        });

        return NextResponse.json({ patients });
      }

      return NextResponse.json({ error: "Patient ID required" }, { status: 400 });
    }

    const vitals = await prisma.vital.findMany({
      where: { patientId },
      orderBy: { recordedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ vitals });
  } catch (error) {
    console.error("GET /api/vitals error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST: Save vital reading with anomaly check ─────────

const createVitalSchema = z.object({
  bloodPressure: z.string().optional(),
  heartRate: z.number().optional(),
  temperature: z.number().optional(),
  respiratoryRate: z.number().optional(),
  oxygenSaturation: z.number().optional(),
  weight: z.number().optional(),
  height: z.number().optional(),
  bloodSugar: z.number().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      include: { patient: true },
    });

    if (!user?.patient) {
      return NextResponse.json({ error: "Patient profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const validated = createVitalSchema.parse(body);

    // Check for anomalies
    const anomalies = checkAnomalies(validated as Record<string, unknown>);

    // Create vital record
    const vital = await prisma.vital.create({
      data: {
        patientId: user.patient.id,
        bloodPressure: validated.bloodPressure || null,
        heartRate: validated.heartRate ?? null,
        temperature: validated.temperature ?? null,
        respiratoryRate: validated.respiratoryRate ?? null,
        oxygenSaturation: validated.oxygenSaturation ?? null,
        weight: validated.weight ?? null,
        height: validated.height ?? null,
        bloodSugar: validated.bloodSugar ?? null,
        notes: validated.source
          ? `Source: ${validated.source}${validated.notes ? `. ${validated.notes}` : ""}`
          : validated.notes || null,
      },
    });

    // If abnormal, create notifications for patient and their doctors
    if (anomalies.length > 0) {
      const alertMessage = `Abnormal reading detected: ${anomalies.join("; ")}`;

      // Notify patient
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: "Abnormal Vital Reading",
          message: alertMessage,
          type: "VITAL_ALERT",
          link: "/patient/vitals",
        },
      });

      // Notify doctors who have appointments with this patient
      const recentDoctors = await prisma.appointment.findMany({
        where: {
          patientId: user.patient.id,
          status: { in: ["SCHEDULED", "CONFIRMED", "COMPLETED"] },
        },
        select: { doctor: { select: { userId: true } } },
        distinct: ["doctorId"],
        take: 5,
      });

      for (const appt of recentDoctors) {
        await prisma.notification.create({
          data: {
            userId: appt.doctor.userId,
            title: "Patient Vital Alert",
            message: `${user.firstName} ${user.lastName}: ${alertMessage}`,
            type: "VITAL_ALERT",
            link: "/doctor/monitoring",
          },
        });
      }
    }

    return NextResponse.json(
      { vital, anomalies, isAbnormal: anomalies.length > 0 },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    console.error("POST /api/vitals error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
