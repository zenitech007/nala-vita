import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { cancelReminder } from "@/lib/amelia/reminders";

async function getPatientId(): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  const user = await prisma.user.findUnique({ where: { supabaseId: authUser.id }, include: { patient: true } });
  return user?.patient?.id ?? null;
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
