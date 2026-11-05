import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isIanaTimeZone } from "@/lib/appointment-availability";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const availability = z.object({
  timeZone: z.string().refine(isIanaTimeZone, "Choose a valid IANA timezone"),
  availableDays: z.array(z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])).min(1).max(7),
  availableFrom: clock, availableTo: clock,
}).refine(value => value.availableFrom < value.availableTo, "End time must follow start time on the same day");

export async function PATCH(req: NextRequest) {
  const auth = await requireApiUser({ roles: ["DOCTOR"], profile: "doctor" });
  if (!auth.ok) return auth.response;
  try {
    const data = availability.parse(await req.json());
    await prisma.doctor.update({ where: { id: auth.user.doctor!.id }, data });
    return NextResponse.json({ availability: data });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid availability", details: error.issues }, { status: 422 });
    return NextResponse.json({ error: "Could not save availability" }, { status: 500 });
  }
}
