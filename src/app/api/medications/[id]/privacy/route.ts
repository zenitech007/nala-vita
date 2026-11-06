import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const privacySchema = z.object({
  isSharedWithDoctor: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const resolvedParams = await Promise.resolve(params);
    const prescriptionId = resolvedParams.id;

    const medication = await prisma.prescription.findFirst({
      where: { id: prescriptionId, patientId: user.patient!.id },
    });

    if (!medication || medication.patientId !== user.patient!.id) {
      return NextResponse.json(
        { error: "Medication not found or does not belong to your account" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const validated = privacySchema.parse(body);

    const updated = await prisma.prescription.update({
      where: { id: prescriptionId, patientId: user.patient!.id },
      data: { isSharedWithDoctor: validated.isSharedWithDoctor },
    });

    // Record audit log for HIPAA compliance
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: validated.isSharedWithDoctor
          ? "SHARE_MEDICATION_WITH_DOCTOR"
          : "RESTRICT_MEDICATION_FROM_DOCTOR",
        resourceType: "PRESCRIPTION",
        resourceId: prescriptionId,
        metadata: JSON.stringify({
          medication: medication.medication,
          isSharedWithDoctor: validated.isSharedWithDoctor,
        }),
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      isSharedWithDoctor: updated.isSharedWithDoctor,
      message: updated.isSharedWithDoctor
        ? "Medication may be viewed only within an approved access grant; its author retains access."
        : "Medication hidden from grant-based readers. Its author retains access.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("[PATCH /api/medications/[id]/privacy]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
