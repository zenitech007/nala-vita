import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireApiUser({ roles: ["ADMIN"], profile: "admin" });
  if (!auth.ok) return auth.response;
  const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
  if (!["PENDING", "VERIFIED", "REJECTED", "ALL"].includes(status)) {
    return NextResponse.json({ error: "Invalid verification status." }, { status: 422 });
  }
  const where = status === "ALL" ? {} : {
    OR: [
      { verification: { is: { status } } },
      ...(status === "PENDING" ? [{ verification: { is: null }, isVerified: false }] : []),
    ],
  };
  const doctors = await prisma.doctor.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 100,
    select: {
      id: true, specialization: true, licenseNumber: true, isVerified: true, updatedAt: true,
      user: { select: { firstName: true, lastName: true, isActive: true } },
      verification: { select: { status: true, reason: true, reviewedAt: true, reviewer: { select: { firstName: true, lastName: true } } } },
    },
  });
  return NextResponse.json({ doctors }, { headers: { "Cache-Control": "no-store" } });
}
