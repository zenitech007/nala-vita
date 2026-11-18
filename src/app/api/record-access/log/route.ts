import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consentApiError } from "@/lib/consent-api";
export async function GET(req: NextRequest) {
  const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
  if (!auth.ok) return auth.response;
  try {
    const cursor = new URL(req.url).searchParams.get("cursor"), patientId = auth.user.patient!.id;
    if (cursor && !await prisma.recordAccessLog.findFirst({ where: { id: cursor, patientId }, select: { id: true } })) return NextResponse.json({ error: "Log page not available" }, { status: 400 });
    const logs = await prisma.recordAccessLog.findMany({ where: { patientId }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), orderBy: [{ viewedAt: "desc" }, { id: "desc" }],
      include: { viewerUser: { select: { firstName: true, lastName: true, role: true } }, viewerFacility: { select: { name: true } } } });
    return NextResponse.json({ logs, nextCursor: logs.length === 100 ? logs[logs.length - 1].id : null });
  } catch (error) { return consentApiError(error); }
}
