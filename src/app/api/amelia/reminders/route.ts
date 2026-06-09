import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { createReminder, listReminders } from "@/lib/amelia/reminders";

async function getPatientId(): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  const user = await prisma.user.findUnique({ where: { supabaseId: authUser.id }, include: { patient: true } });
  return user?.patient?.id ?? null;
}

const createSchema = z.object({
  kind: z.enum(["MEDICATION", "APPOINTMENT", "VITALS", "OTHER"]),
  label: z.string().min(1).max(200),
  frequency: z.enum(["ONCE", "DAILY"]),
  nextFireAt: z.string().datetime(),
});

export async function POST(req: NextRequest) {
  try {
    const patientId = await getPatientId();
    if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = createSchema.parse(await req.json());
    await createReminder(patientId, {
      kind: body.kind,
      label: body.label,
      frequency: body.frequency,
      nextFireAt: new Date(body.nextFireAt),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    console.error("Reminder POST error:", error);
    return NextResponse.json({ error: "Failed to create reminder." }, { status: 500 });
  }
}

export async function GET() {
  const patientId = await getPatientId();
  if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reminders = await listReminders(patientId);
  return NextResponse.json({ reminders });
}
