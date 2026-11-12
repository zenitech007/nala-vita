import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withProviderDeadline } from "@/lib/provider-deadline";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await withProviderDeadline(() => prisma.$queryRaw`SELECT 1 AS ready`, undefined, 3000);
    return NextResponse.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
