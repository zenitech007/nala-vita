// src/lib/amelia/context.ts
import { loadVisiblePatientRecord } from "@/lib/visible-patient-record";
import type { RecordViewer } from "@/lib/record-visibility";
import type { AmeliaContext } from "./types";

function ageFromDob(dob: Date | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export async function getPatientContext(patientId: string, viewer: RecordViewer): Promise<AmeliaContext> {
  const now = new Date();
  const record = await loadVisiblePatientRecord(viewer, patientId);
  const patient = { ...record.patient, ...record };
  const profile = record.patient;

  const recentLabs = (patient.labOrders || []).flatMap((o) =>
    (o.results || []).map((r) => ({
      testName: o.testName,
      resultValue: r.resultValue,
      unit: r.unit,
      isAbnormal: r.isAbnormal,
    }))
  );

  const upcomingAppointments = (patient.appointments || []).filter(a => a.scheduledAt >= now && ["CONFIRMED", "SCHEDULED"].includes(a.status)).map((a) => ({
    doctorName: `${a.doctor.user.firstName} ${a.doctor.user.lastName}`,
    specialization: a.doctor.specialization,
    date: a.scheduledAt.toISOString().split("T")[0],
    reason: a.reason,
  }));

  const recentDiagnosesOrNotes = (patient.medicalNotes || []).map((n) => ({
    title: n.title,
    category: n.category ?? undefined,
    date: n.createdAt.toISOString().split("T")[0],
  }));

  return {
    firstName: profile.user.firstName,
    age: ageFromDob(profile.dateOfBirth),
    gender: profile.gender,
    bloodType: profile.bloodType,
    allergies: profile.allergies,
    accessLimited: record.accessLimited,
    activeMedications: (patient.prescriptions || []).filter(p => p.isActive).map((p) => ({
      medication: p.medication,
      dosage: p.dosage,
      frequency: p.frequency,
      instructions: p.instructions,
    })),
    recentVitals: (patient.vitals || []).map((v) => ({
      recordedAt: v.recordedAt.toISOString().slice(0, 10),
      bloodPressure: v.bloodPressure,
      heartRate: v.heartRate,
      bloodSugar: v.bloodSugar,
      oxygenSaturation: v.oxygenSaturation,
      temperature: v.temperature ?? null,
      temperatureUnit: "C",
    })),
    recentLabs,
    upcomingAppointments,
    recentDiagnosesOrNotes,
  };
}
