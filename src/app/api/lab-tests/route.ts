import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// ─── GET: Return lab orders/results based on user role ───

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
    const status = searchParams.get("status"); // "pending" | "completed"

    // Build where clause based on role
    let whereClause: Record<string, unknown> = {};

    if (user.role === "PATIENT" && user.patient) {
      whereClause = { patientId: user.patient.id };
    } else if (user.role === "DOCTOR" && user.doctor) {
      whereClause = { doctorId: user.doctor.id };
    } else {
      return NextResponse.json(
        { error: "No patient or doctor profile found" },
        { status: 403 }
      );
    }

    // Filter by status
    if (status === "pending") {
      whereClause.results = { none: {} };
    } else if (status === "completed") {
      whereClause.results = { some: {} };
    }

    const labOrders = await prisma.labOrder.findMany({
      where: whereClause,
      include: {
        patient: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        doctor: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        results: {
          orderBy: { completedAt: "desc" },
        },
      },
      orderBy: { orderedAt: "desc" },
    });

    return NextResponse.json({ labOrders });
  } catch (error) {
    console.error("GET /api/lab-tests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── POST: Create a lab order and notify the patient ─────

const createLabOrderSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  testName: z.string().min(1, "Test name is required"),
  testCode: z.string().optional(),
  instructions: z.string().optional(),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("LOW"),
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
        { error: "Only doctors can create lab orders" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = createLabOrderSchema.parse(body);

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: validated.patientId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
    }

    // Create lab order and notification in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const labOrder = await tx.labOrder.create({
        data: {
          patientId: validated.patientId,
          doctorId: user.doctor!.id,
          testName: validated.testName,
          testCode: validated.testCode || null,
          instructions: validated.instructions || null,
          urgency: validated.urgency,
        },
        include: {
          patient: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          doctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          results: true,
        },
      });

      // Notify the patient
      await tx.notification.create({
        data: {
          userId: patient.user.id,
          title: "New Lab Order",
          message: `Dr. ${user.firstName} ${user.lastName} has ordered a ${validated.testName}${validated.urgency !== "LOW" ? ` (${validated.urgency} priority)` : ""}. ${validated.instructions ? `Instructions: ${validated.instructions}` : ""}`.trim(),
          type: "LAB_ORDER",
          link: "/patient/lab-results",
        },
      });

      return labOrder;
    });

    return NextResponse.json({ labOrder: result }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("POST /api/lab-tests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
