import { loadVisiblePatientRecord } from "@/lib/visible-patient-record";
import { requireApiUser } from "@/lib/auth";
import { doctorHasPatientAccess } from "@/lib/access-control";
import { NextRequest, NextResponse } from "next/server";


import { checkRateLimitAsync } from "@/lib/rate-limit";
import { getCachedOrAnalyze, analyzeMedications } from "@/lib/amelia/medsafety";

export async function GET() {
  const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const limit = await checkRateLimitAsync(`amelia:med-safety:${user.id}`);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const record = await loadVisiblePatientRecord(user, user.patient!.id);
  const meds = record.prescriptions.filter(p => p.isActive).map(p => ({ medication: p.medication, dosage: p.dosage }));
  const result = await getCachedOrAnalyze(user.patient!.id, meds, record.patient.allergies);
  return NextResponse.json({ result });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiUser({roles:['PATIENT','DOCTOR']});
    if (!auth.ok) return auth.response;
    const {user} = auth;
    const limit = await checkRateLimitAsync(`amelia:med-safety:${user.id}`);
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

    const body = await req.json();
    const { medications, allergies } = body;
    let patientId = body.patientId;
    if (user.role === 'PATIENT') {
      if (!user.patient || (patientId && patientId !== user.patient.id)) return NextResponse.json({error:'Forbidden'}, {status:403});
      patientId = user.patient.id;
    } else if (patientId && (!user.doctor || !await doctorHasPatientAccess(user.doctor.id, patientId))) {
      return NextResponse.json({error:'Forbidden'}, {status:403});
    }

    let targetAllergies: string[] = Array.isArray(allergies) ? allergies : [];
    const allMeds: { medication: string; dosage: string }[] = Array.isArray(medications)
      ? medications.map((m: { medication?: string; dosage?: string }) => ({
          medication: String(m?.medication || ""),
          dosage: String(m?.dosage || ""),
        }))
      : [];

    if (patientId) {
      const record = await loadVisiblePatientRecord(user, patientId);
      if (!targetAllergies.length && record.profileAvailable) targetAllergies = record.patient.allergies;
      for (const p of record.prescriptions.filter(item => item.isActive)) {
        if (!allMeds.some(m => m.medication.toLowerCase() === p.medication.toLowerCase())) allMeds.push({ medication: p.medication, dosage: p.dosage });
      }
    }

    const result = await analyzeMedications(allMeds, targetAllergies);
    return NextResponse.json({ result, accessLimited: user.role === "DOCTOR", notice: user.role === "DOCTOR" ? "Only visible records were checked; unavailable history may contain additional risks." : undefined });
  } catch (error) {
    console.error("POST /api/amelia/med-safety error:", error);
    return NextResponse.json({ error: "Failed to evaluate medication safety" }, { status: 500 });
  }
}
