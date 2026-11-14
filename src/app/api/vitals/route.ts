import { parsePagination, cursorWhere, pageResult, PaginationError } from "@/lib/pagination";
import { requireApiUser } from "@/lib/auth";
import { getRecordVisibility, workspacePatientWhere } from "@/lib/record-visibility";
import { loadVisiblePatientRecord } from "@/lib/visible-patient-record";
import { doctorHasPatientAccess } from "@/lib/access-control";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { TEMPERATURE, temperatureToCelsius } from "@/lib/temperature";

// ─── Reference ranges for anomaly detection ──────────────

const REFERENCE_RANGES = {
  heartRate: { min: 60, max: 100, label: "Heart Rate" },
  temperature: { min: TEMPERATURE.normalMinC, max: TEMPERATURE.normalMaxC, label: "Temperature (°C)" },
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
    const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR"] });
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const query = new URL(req.url).searchParams;
    const patientId = user.role === "PATIENT" ? user.patient!.id : query.get("patientId");
    const { limit, cursor } = parsePagination(query);
    if (!patientId) {
      const targets = await prisma.patient.findMany({ where: { AND: [workspacePatientWhere(user.doctor!.id), cursorWhere(cursor, "createdAt")] }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1, select: { id: true, createdAt: true } });
      const page = pageResult(targets, limit, "createdAt");
      const patients = await Promise.all(page.items.map(async target => {
        const record = await loadVisiblePatientRecord(user, target.id);
        return { id: target.id, user: record.patient.user, vitals: record.vitals.slice(0, 1), accessLimited: true };
      }));
      return NextResponse.json({ patients, nextCursor: page.nextCursor });
    }
    if (user.role === "DOCTOR" && !await doctorHasPatientAccess(user.doctor!.id, patientId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const access = await getRecordVisibility(user, patientId);
    const vitals = await prisma.vital.findMany({ where: { AND: [access.where("VITALS"), cursorWhere(cursor, "recordedAt")] }, orderBy: [{ recordedAt: "desc" }, { id: "desc" }], take: limit + 1 });
    const page = pageResult(vitals, limit, "recordedAt");
    await access.log("VITALS", page.items);
    return NextResponse.json({ vitals: page.items, nextCursor: page.nextCursor });
  } catch (error) {
    if (error instanceof PaginationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("GET /api/vitals error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST: Save vital reading with anomaly check ─────────

const createVitalSchema = z.object({
  patientId: z.string().min(1).optional(),
  bloodPressure: z.string().optional(),
  heartRate: z.number().optional(),
  temperature: z.number().optional(),
  temperatureUnit: z.enum(["C", "F"]).optional(),
  respiratoryRate: z.number().optional(),
  oxygenSaturation: z.number().optional(),
  weight: z.number().optional(),
  height: z.number().optional(),
  bloodSugar: z.number().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
}).refine(value => (value.temperature === undefined) === (value.temperatureUnit === undefined), {
  message: "Temperature requires an explicit C or F unit", path: ["temperatureUnit"],
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR"] });
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const body = await req.json();
    const validated = createVitalSchema.parse(body);
    const patientId = user.role === "PATIENT" ? user.patient?.id : validated.patientId;
    if (!patientId) return NextResponse.json({ error: "Patient profile or target required" }, { status: 403 });
    if (user.role === "DOCTOR" && !await doctorHasPatientAccess(user.doctor!.id, patientId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const target = user.role === "PATIENT" ? { userId: user.id } : await prisma.patient.findUnique({ where: { id: patientId }, select: { userId: true } });
    if (!target) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    // Check for anomalies
    const canonicalTemperature = validated.temperature === undefined ? null : temperatureToCelsius(validated.temperature, validated.temperatureUnit!);
    const anomalies = checkAnomalies({ ...validated, temperature: canonicalTemperature });

    // Create vital record
    const vital = await prisma.vital.create({
      data: {
        patientId,
        authoredByUserId: user.id, authoredByDoctorId: user.role === "DOCTOR" ? user.doctor!.id : null,
        bloodPressure: validated.bloodPressure || null,
        heartRate: validated.heartRate ?? null,
        temperature: canonicalTemperature,
        temperatureUnit: "C",
        temperatureOriginal: validated.temperature ?? null,
        temperatureOriginalUnit: validated.temperatureUnit ?? null,
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
          userId: target.userId,
          title: "Abnormal Vital Reading",
          message: alertMessage,
          type: "VITAL_ALERT",
          link: "/patient/vitals",
        },
      });

      // Appointment membership alone does not authorize disclosure of vital values.
      // The patient notification above is private; providers read through scoped monitoring.
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
