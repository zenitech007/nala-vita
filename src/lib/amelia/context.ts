// src/lib/amelia/context.ts
import { prisma } from "@/lib/prisma";
import type { AmeliaContext } from "./types";

function ageFromDob(dob: Date | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export async function getPatientContext(patientId: string): Promise<AmeliaContext> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      user: true,
      vitals: { orderBy: { recordedAt: "desc" }, take: 3 },
      prescriptions: { where: { isActive: true }, orderBy: { prescribedAt: "desc" }, take: 10 },
      labOrders: { orderBy: { orderedAt: "desc" }, take: 5, include: { results: true } },
    },
  });

  if (!patient) throw new Error(`Patient not found: ${patientId}`);

  const recentLabs = patient.labOrders.flatMap((o) =>
    o.results.map((r) => ({ testName: o.testName, resultValue: r.resultValue, unit: r.unit, isAbnormal: r.isAbnormal }))
  );

  return {
    firstName: patient.user.firstName,
    age: ageFromDob(patient.dateOfBirth),
    gender: patient.gender,
    allergies: patient.allergies,
    activeMedications: patient.prescriptions.map((p) => ({ medication: p.medication, dosage: p.dosage, frequency: p.frequency })),
    recentVitals: patient.vitals.map((v) => ({
      recordedAt: v.recordedAt.toISOString().slice(0, 10),
      bloodPressure: v.bloodPressure,
      heartRate: v.heartRate,
      bloodSugar: v.bloodSugar,
      oxygenSaturation: v.oxygenSaturation,
    })),
    recentLabs,
  };
}
