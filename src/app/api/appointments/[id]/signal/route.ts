import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callTopic, signalSchema } from "@/lib/realtime-events";
import { publishPrivateEvent } from "@/lib/realtime-publish";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { videoIceServers } from "@/lib/turn-config";

type Context = { params: Promise<{ id: string }> };
async function membership(context: Context) {
  const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR"] });
  if (!auth.ok) return { response: auth.response } as const;
  const { id } = await context.params;
  const user = auth.user;
  const initiator = user.role === "DOCTOR";
  const appointment = await prisma.appointment.findFirst({
    where: {
      id, consultationType: "VIDEO", status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
      ...(initiator ? { doctorId: user.doctor!.id } : { patientId: user.patient!.id }),
      doctor: { isVerified: true, user: { isActive: true, role: "DOCTOR" } },
      patient: { user: { isActive: true, role: "PATIENT" } },
    },
    select: { id: true, doctor: { select: { userId: true } }, patient: { select: { userId: true } } },
  });
  if (!appointment) return { response: NextResponse.json({ error: "Video appointment unavailable" }, { status: 404 }) } as const;
  return { id, selfId: user.id, peerId: initiator ? appointment.patient.userId : appointment.doctor.userId, initiator };
}

export async function GET(_request: Request, context: Context) {
  const member = await membership(context);
  if (member.response) return member.response;
  try {
    return NextResponse.json({ ...member, iceServers: videoIceServers() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Video service configuration is unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request, context: Context) {
  const member = await membership(context);
  if (member.response) return member.response;
  const budget = await checkRateLimitAsync(`video-signal:${member.selfId}`, { maxRequests: 120, windowMs: 60_000 });
  if (!budget.allowed) return NextResponse.json({ error: "Video signaling rate limit reached" }, { status: 429 });
  const parsed = signalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid signal" }, { status: 422 });
  if ((parsed.data.type === "offer" && !member.initiator) || (parsed.data.type === "answer" && member.initiator)) {
    return NextResponse.json({ error: "Signal is not allowed for this participant" }, { status: 403 });
  }
  const sent = await publishPrivateEvent(callTopic(member.id, member.peerId), "signal", {
    appointmentId: member.id, senderId: member.selfId, receiverId: member.peerId,
    eventId: randomUUID(), issuedAt: Date.now(), signal: parsed.data,
  });
  if (!sent) return NextResponse.json({ error: "Video signaling is temporarily unavailable" }, { status: 503 });
  return new NextResponse(null, { status: 204 });
}
