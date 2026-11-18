import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

import { cancelReminder } from "@/lib/amelia/reminders";

async function getPatientId(): Promise<string | null> {
  const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
  return auth.ok ? auth.user.patient!.id : null;
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const patientId = await getPatientId();
    if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await cancelReminder(id, patientId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Reminder DELETE error:", error);
    return NextResponse.json({ error: "Failed to cancel reminder." }, { status: 500 });
  }
}
