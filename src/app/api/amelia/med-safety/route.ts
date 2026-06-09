import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { getCachedOrAnalyze } from "@/lib/amelia/medsafety";

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
