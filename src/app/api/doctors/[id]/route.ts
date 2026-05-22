import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: { firstName: true, lastName: true, avatarUrl: true, email: true },
        },
      },
    });

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    const totalConsultations = await prisma.appointment.count({
      where: { doctorId: doctor.id, status: "COMPLETED" },
    });

    return NextResponse.json({ ...doctor, totalConsultations });
  } catch (error) {
    console.error("[GET /api/doctors/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
