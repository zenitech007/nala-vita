import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const specialization = searchParams.get("specialization");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isVerified: true };
    if (specialization) {
      where.specialization = specialization;
    }

    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { rating: "desc" },
        select: {
          id: true,
          specialization: true,
          consultationFee: true,
          availableDays: true,
          availableFrom: true,
          availableTo: true,
          isVerified: true,
          rating: true,
          totalReviews: true,
          user: {
            select: { firstName: true, lastName: true, avatarUrl: true },
          },
        },
      }),
      prisma.doctor.count({ where }),
    ]);

    return NextResponse.json({ doctors, total, page, limit });
  } catch (error) {
    console.error("[GET /api/doctors]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
