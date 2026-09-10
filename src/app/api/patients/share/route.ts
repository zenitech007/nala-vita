import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createNotification } from "@/lib/notifications";

const shareSchema = z.object({
  doctorId: z.string().min(1, "Doctor ID is required"),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
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
      include: { patient: true },
    });

    if (!user || user.role !== "PATIENT" || !user.patient) {
      return NextResponse.json(
        { error: "Forbidden: Only registered patients can share records" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = shareSchema.parse(body);

    const doctor = await prisma.doctor.findUnique({
      where: { id: validated.doctorId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!doctor) {
      return NextResponse.json({ error: "Healthcare provider not found" }, { status: 404 });
    }

    // Check if an existing active appointment or connection exists
    const existing = await prisma.appointment.findFirst({
      where: {
        patientId: user.patient.id,
        doctorId: doctor.id,
      },
    });

    if (!existing) {
      // Create a confirmed direct record-sharing connection
      await prisma.appointment.create({
        data: {
          patientId: user.patient.id,
          doctorId: doctor.id,
          scheduledAt: new Date(),
          duration: 30,
          status: "CONFIRMED",
          consultationType: "CHAT",
          urgencyLevel: "LOW",
          reason: validated.reason || "Patient Direct Medical Record Share",
          notes: validated.notes || "Patient directly authorized healthcare provider access to clinical history.",
        },
      });
    }

    // Notify receiving doctor
    await createNotification(
      doctor.user.id,
      "New Patient Record Shared",
      `Patient ${user.firstName} ${user.lastName} has authorized and shared their medical records with you for clinical review. Reason: ${validated.reason || "Care Consultation"}`,
      "RECORD_SHARE",
      { link: "/doctor/patients" }
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PATIENT_RECORD_SHARE",
        resourceType: "PATIENT_RECORD",
        resourceId: user.patient.id,
        metadata: JSON.stringify({
          targetDoctorId: doctor.id,
          targetDoctorName: `${doctor.user.firstName} ${doctor.user.lastName}`,
          reason: validated.reason,
        }),
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Medical records shared successfully with Dr. ${doctor.user.firstName} ${doctor.user.lastName}.`,
      doctor: {
        id: doctor.id,
        name: `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("[POST /api/patients/share]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
