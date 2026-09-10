import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { confirmMemory, updateMemory, deleteMemory } from "@/lib/amelia/memory";

const patchSchema = z.union([
  z.object({ action: z.literal("confirm") }),
  z.object({ value: z.string().min(1).max(500) }),
]);

async function getPatientId(): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  const user = await prisma.user.findUnique({ where: { supabaseId: authUser.id }, include: { patient: true } });
  return user?.patient?.id ?? null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const patientId = await getPatientId();
    if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = patchSchema.parse(await req.json());
    if ("action" in body) {
      await confirmMemory(id, patientId);
    } else {
      await updateMemory(id, patientId, body.value);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    console.error("Memory PATCH error:", error);
    return NextResponse.json({ error: "Failed to update memory." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const patientId = await getPatientId();
    if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await deleteMemory(id, patientId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Memory DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete memory." }, { status: 500 });
  }
}
