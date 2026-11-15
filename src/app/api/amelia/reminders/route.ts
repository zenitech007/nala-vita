import { isIanaTimeZone } from "@/lib/appointment-availability";
import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createReminder, listReminders } from "@/lib/amelia/reminders";

async function getPatientId(): Promise<string | null> {
  const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
  return auth.ok ? auth.user.patient!.id : null;
}

const createSchema = z.object({
  kind: z.enum(["MEDICATION", "APPOINTMENT", "VITALS", "OTHER"]),
  label: z.string().min(1).max(200),
  frequency: z.enum(["ONCE", "DAILY"]),
  nextFireAt: z.string().datetime().refine(value => Date.parse(value) > Date.now(), "Choose a future reminder time."),
  timeZone: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
    if (!auth.ok) return auth.response;
    const patientId = auth.user.patient!.id;
    const timeZone = auth.user.timeZone;
    if (!timeZone || !isIanaTimeZone(timeZone)) {
      return NextResponse.json({ error: "Save your IANA timezone in Settings before setting reminders." }, { status: 422 });
    }
    const body = createSchema.parse(await req.json());
    if (body.timeZone && body.timeZone !== timeZone) {
      return NextResponse.json({ error: "Your timezone changed. Request a new reminder suggestion." }, { status: 409 });
    }
    await createReminder(patientId, {
      kind: body.kind,
      label: body.label,
      frequency: body.frequency,
      nextFireAt: new Date(body.nextFireAt),
      timeZone,
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
