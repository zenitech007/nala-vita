import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { listMemories } from "@/lib/amelia/memory";

export async function GET(_req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { supabaseId: authUser.id }, include: { patient: true } });
  if (!user?.patient) return NextResponse.json({ error: "Patient profile not found" }, { status: 404 });

  const memories = await listMemories(user.patient.id);
  return NextResponse.json({ memories });
}
