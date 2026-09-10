import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100).optional(),
  lastName: z.string().min(1, "Last name is required").max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  emergencyName: z.string().max(100).optional().nullable(),
  emergencyPhone: z.string().max(20).optional().nullable(),
  address: z.string().max(250).optional().nullable(),
  bloodType: z.string().max(10).optional().nullable(),
  insuranceProvider: z.string().max(100).optional().nullable(),
  insuranceNumber: z.string().max(50).optional().nullable(),
});

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? "",
      role: user.role,
      avatarUrl: user.avatarUrl,
      patient: user.patient
        ? {
            bloodType: user.patient.bloodType ?? "",
            allergies: user.patient.allergies ?? [],
            emergencyName: user.patient.emergencyName ?? "",
            emergencyPhone: user.patient.emergencyPhone ?? "",
            address: user.patient.address ?? "",
            insuranceProvider: user.patient.insuranceProvider ?? "",
            insuranceNumber: user.patient.insuranceNumber ?? "",
            gender: user.patient.gender,
            dateOfBirth: user.patient.dateOfBirth,
          }
        : null,
      doctor: user.doctor
        ? {
            specialization: user.doctor.specialization,
            licenseNumber: user.doctor.licenseNumber,
            yearsOfExperience: user.doctor.yearsOfExperience,
            consultationFee: user.doctor.consultationFee,
            isVerified: user.doctor.isVerified,
          }
        : null,
    });
  } catch (error) {
    console.error("GET /api/settings/profile error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile settings" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const validated = updateProfileSchema.parse(body);

    // Update base User
    const userUpdate: { firstName?: string; lastName?: string; phone?: string | null } = {};
    if (validated.firstName !== undefined) userUpdate.firstName = validated.firstName;
    if (validated.lastName !== undefined) userUpdate.lastName = validated.lastName;
    if (validated.phone !== undefined) userUpdate.phone = validated.phone;

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: userUpdate,
      });
    }

    // Update patient profile if applicable
    if (user.patient) {
      const patientUpdate: {
        emergencyName?: string | null;
        emergencyPhone?: string | null;
        address?: string | null;
        bloodType?: string | null;
        insuranceProvider?: string | null;
        insuranceNumber?: string | null;
      } = {};

      if (validated.emergencyName !== undefined) patientUpdate.emergencyName = validated.emergencyName;
      if (validated.emergencyPhone !== undefined) patientUpdate.emergencyPhone = validated.emergencyPhone;
      if (validated.address !== undefined) patientUpdate.address = validated.address;
      if (validated.bloodType !== undefined) patientUpdate.bloodType = validated.bloodType;
      if (validated.insuranceProvider !== undefined) patientUpdate.insuranceProvider = validated.insuranceProvider;
      if (validated.insuranceNumber !== undefined) patientUpdate.insuranceNumber = validated.insuranceNumber;

      if (Object.keys(patientUpdate).length > 0) {
        await prisma.patient.update({
          where: { userId: user.id },
          data: patientUpdate,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Profile settings saved successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }

    console.error("PUT /api/settings/profile error:", error);
    return NextResponse.json(
      { error: "Failed to update profile settings" },
      { status: 500 }
    );
  }
}
