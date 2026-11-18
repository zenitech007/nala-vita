import { labResultVisibilityWhere } from "@/lib/record-visibility";
import { requireApiUser } from "@/lib/auth";
import { getCollectionVisibility } from "@/lib/record-visibility";
import { doctorHasPatientAccess } from "@/lib/access-control";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";


// ─── GET: Return lab orders/results based on user role ───

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR"] });
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const access = await getCollectionVisibility(user, "LAB_TESTS", new URL(req.url).searchParams.get("patientId") ?? undefined);
    const labOrders = await prisma.labOrder.findMany({
      where: access.where("LAB_TESTS"),
      include: {
        patient: { select: { id: true, user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        doctor: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        results: {
          where: labResultVisibilityWhere(access.where("LAB_TESTS")),
          orderBy: { completedAt: "desc" },
        },
      },
      orderBy: { orderedAt: "desc" },
    });

    await access.log("LAB_TESTS", labOrders);
    await access.log("LAB_RESULT", labOrders.flatMap(order => order.results.map(result => ({ ...result, patientId: order.patientId }))));
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
    const auth = await requireApiUser({ roles: ["DOCTOR"], profile: "doctor" });
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const body = await req.json();
    const validated = createLabOrderSchema.parse(body);

    if (!await doctorHasPatientAccess(user.doctor!.id, validated.patientId)) return NextResponse.json({error:'Forbidden'}, {status:403});

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
          authoredByDoctorId: user.doctor!.id, authoredByUserId: user.id,
          testName: validated.testName,
          testCode: validated.testCode || null,
          instructions: validated.instructions || null,
          urgency: validated.urgency,
        },
        include: {
          patient: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
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
