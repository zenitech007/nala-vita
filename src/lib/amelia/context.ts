// src/lib/amelia/context.ts
import { prisma } from "@/lib/prisma";
import type { AmeliaContext } from "./types";

function ageFromDob(dob: Date | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export async function getPatientContext(patientId: string): Promise<AmeliaContext> {
  const now = new Date();
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      user: true,
      vitals: { orderBy: { recordedAt: "desc" }, take: 3 },
      prescriptions: { where: { isActive: true }, orderBy: { prescribedAt: "desc" }, take: 10 },
      labOrders: { orderBy: { orderedAt: "desc" }, take: 5, include: { results: true } },
      appointments: {
        where: { scheduledAt: { gte: now }, status: { in: ["CONFIRMED", "SCHEDULED"] } },
        orderBy: { scheduledAt: "asc" },
        take: 3,
        include: {
          doctor: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
      medicalNotes: {
        where: { isPrivate: false },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  if (!patient) throw new Error(`Patient not found: ${patientId}`);

  const recentLabs = (patient.labOrders || []).flatMap((o) =>
    (o.results || []).map((r) => ({
      testName: o.testName,
      resultValue: r.resultValue,
      unit: r.unit,
      isAbnormal: r.isAbnormal,
    }))
  );

  const upcomingAppointments = (patient.appointments || []).map((a) => ({
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
    firstName: patient.user.firstName,
    age: ageFromDob(patient.dateOfBirth),
    gender: patient.gender,
    bloodType: patient.bloodType,
    allergies: patient.allergies,
    activeMedications: (patient.prescriptions || []).map((p) => ({
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
    })),
    recentLabs,
    upcomingAppointments,
    recentDiagnosesOrNotes,
  };
}
