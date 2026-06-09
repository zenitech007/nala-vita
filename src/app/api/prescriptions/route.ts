import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { checkNewPrescriptionSafety } from "@/lib/amelia/medsafety";

// ─── GET: Return prescriptions by role ───────────────────

export async function GET(req: NextRequest) {
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
      include: { patient: true, doctor: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") !== "false";

    // Build role-based filter
    let roleFilter: object;
    if (user.role === "DOCTOR" && user.doctor) {
      roleFilter = { doctorId: user.doctor.id };
    } else if (user.patient) {
      roleFilter = { patientId: user.patient.id };
    } else {
      // Admin — return all (with optional patient filter)
      const patientId = searchParams.get("patientId");
      roleFilter = patientId ? { patientId } : {};
    }

    const prescriptions = await prisma.prescription.findMany({
      where: {
        ...roleFilter,
        ...(activeOnly ? {} : {}), // Return all, frontend filters by isActive
      },
      include: {
        patient: {
          include: {
            user: {
              select: { firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
        doctor: {
          include: {
            user: {
              select: { firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { prescribedAt: "desc" },
    });

    return NextResponse.json({ prescriptions });
  } catch (error) {
    console.error("GET /api/prescriptions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST: Create a new prescription ─────────────────────

const createPrescriptionSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  medication: z.string().min(1, "Medication name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  duration: z.string().min(1, "Duration is required"),
  instructions: z.string().optional(),
  refillsAllowed: z.number().min(0).max(12).optional(),
  expiresAt: z.string().datetime().optional(),
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
      include: { doctor: true },
    });

    if (!user?.doctor) {
      return NextResponse.json(
        { error: "Only doctors can create prescriptions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = createPrescriptionSchema.parse(body);

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: validated.patientId },
      include: { user: true },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // Create prescription and notification in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const prescription = await tx.prescription.create({
        data: {
          patientId: validated.patientId,
          doctorId: user.doctor!.id,
          medication: validated.medication,
          dosage: validated.dosage,
          frequency: validated.frequency,
          duration: validated.duration,
          instructions: validated.instructions || null,
          refillsAllowed: validated.refillsAllowed || 0,
          expiresAt: validated.expiresAt
            ? new Date(validated.expiresAt)
            : null,
          isActive: true,
        },
        include: {
          doctor: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
      });

      // Create notification for the patient
      const notification = await tx.notification.create({
        data: {
          userId: patient.userId,
          title: "New Prescription",
          message: `Dr. ${user.firstName} ${user.lastName} has prescribed ${validated.medication} (${validated.dosage}). Check your prescriptions for details.`,
          type: "PRESCRIPTION",
          link: "/patient/prescriptions",
        },
      });

      return { prescription, notification };
    });

    // Phase 2 med-coach: best-effort safety check on the new medication
    // (never block or break prescribing).
    try {
      await checkNewPrescriptionSafety(validated.patientId, validated.medication);
    } catch (safetyErr) {
      console.error("Medication safety check failed:", safetyErr);
    }

    return NextResponse.json(
      {
        message: "Prescription created successfully",
        prescription: result.prescription,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("POST /api/prescriptions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
