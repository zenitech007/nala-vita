import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { getCachedOrAnalyze, analyzeMedications } from "@/lib/amelia/medsafety";

export async function GET(_req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    include: { patient: { include: { prescriptions: { where: { isActive: true } } } } },
  });
  if (!user?.patient) return NextResponse.json({ error: "Patient profile not found" }, { status: 404 });

  const limit = await checkRateLimitAsync(`amelia:med-safety:${user.id}`);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const meds = user.patient.prescriptions.map((p) => ({ medication: p.medication, dosage: p.dosage }));
  const result = await getCachedOrAnalyze(user.patient.id, meds, user.patient.allergies);
  return NextResponse.json({ result });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      include: { doctor: true, patient: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const limit = await checkRateLimitAsync(`amelia:med-safety:${user.id}`);
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

    const body = await req.json();
    const { patientId, medications, allergies } = body;

    let targetAllergies: string[] = Array.isArray(allergies) ? allergies : [];
    const allMeds: { medication: string; dosage: string }[] = Array.isArray(medications)
      ? medications.map((m: { medication?: string; dosage?: string }) => ({
          medication: String(m?.medication || ""),
          dosage: String(m?.dosage || ""),
        }))
      : [];

    if (patientId) {
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: { prescriptions: { where: { isActive: true } } },
      });
      if (patient) {
        if (!targetAllergies.length) {
          targetAllergies = patient.allergies || [];
        }
        for (const p of patient.prescriptions) {
          if (!allMeds.some((m) => m.medication.toLowerCase() === p.medication.toLowerCase())) {
            allMeds.push({ medication: p.medication, dosage: p.dosage });
          }
        }
      }
    }

    const result = await analyzeMedications(allMeds, targetAllergies);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("POST /api/amelia/med-safety error:", error);
    return NextResponse.json({ error: "Failed to evaluate medication safety" }, { status: 500 });
  }
}
