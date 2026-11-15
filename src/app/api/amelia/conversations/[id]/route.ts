import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

import { getConversation, deleteConversation } from "@/lib/amelia/conversations";

async function getPatientId(): Promise<string | null> {
  const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
  return auth.ok ? auth.user.patient!.id : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const patientId = await getPatientId();
    if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conversation = await getConversation(id, patientId);
    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("Amelia conversation GET error:", error);
    return NextResponse.json({ error: "Failed to load conversation." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const patientId = await getPatientId();
    if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await deleteConversation(id, patientId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Amelia conversation DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete conversation." }, { status: 500 });
  }
}
