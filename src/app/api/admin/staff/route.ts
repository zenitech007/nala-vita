import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(_req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const doctors = await prisma.doctor.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const staff = doctors.map((d) => ({
      id: d.id,
      userId: d.user.id,
      name: `Dr. ${d.user.firstName} ${d.user.lastName}`.trim(),
      email: d.user.email,
      role: "DOCTOR" as const,
      speciality: d.specialization,
      licenceNumber: d.licenseNumber,
      department: d.specialization,
      isActive: d.user.isActive,
      joinedAt: d.createdAt.toISOString().slice(0, 10),
    }));

    return NextResponse.json({ staff });
  } catch (error) {
    console.error("GET /api/admin/staff error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { doctorId, isActive, department, speciality } = body;

    if (!doctorId) {
      return NextResponse.json({ error: "Doctor ID is required" }, { status: 400 });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { user: true },
    });

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    if (typeof isActive === "boolean") {
      await prisma.user.update({
        where: { id: doctor.userId },
        data: { isActive },
      });
    }

    if (department || speciality) {
      await prisma.doctor.update({
        where: { id: doctorId },
        data: { specialization: department || speciality },
      });
    }

    return NextResponse.json({ message: "Staff member updated successfully" });
  } catch (error) {
    console.error("PATCH /api/admin/staff error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
