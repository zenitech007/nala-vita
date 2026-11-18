import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { doctorHasPatientAccess } from "@/lib/access-control";
import { loadVisiblePatientRecord } from "@/lib/visible-patient-record";
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser({ roles: ["DOCTOR"], profile: "doctor" });
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!await doctorHasPatientAccess(auth.user.doctor!.id, id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { return NextResponse.json(await loadVisiblePatientRecord(auth.user, id)); }
  catch { return NextResponse.json({ error: "Patient record unavailable" }, { status: 500 }); }
}
