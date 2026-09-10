import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { getConversation, deleteConversation } from "@/lib/amelia/conversations";

async function getPatientId(): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  const user = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    include: { patient: true },
  });
  return user?.patient?.id ?? null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const patientId = await getPatientId();
    if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conversation = await getConversation(params.id, patientId);
    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("Amelia conversation GET error:", error);
    return NextResponse.json({ error: "Failed to load conversation." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const patientId = await getPatientId();
    if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await deleteConversation(params.id, patientId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Amelia conversation DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete conversation." }, { status: 500 });
  }
}
