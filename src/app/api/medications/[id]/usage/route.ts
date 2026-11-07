import { logAudit } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const logUsageSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  action: z.enum(["toggle", "take", "untake"]).optional().default("toggle"),
});

export async function POST(
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

    const body = await req.json().catch(() => ({}));
    const validated = logUsageSchema.parse(body);

    const targetDate =
      validated.date || new Date().toISOString().split("T")[0];

    const currentLogs = Array.isArray(medication.usageLogs)
      ? [...medication.usageLogs]
      : [];

    const isAlreadyLogged = currentLogs.includes(targetDate);
    let updatedLogs: string[];
    let isTaken: boolean;

    if (validated.action === "take") {
      isTaken = true;
      updatedLogs = Array.from(new Set([...currentLogs, targetDate])).sort();
    } else if (validated.action === "untake") {
      isTaken = false;
      updatedLogs = currentLogs.filter((d) => d !== targetDate);
    } else {
      // toggle
      if (isAlreadyLogged) {
        isTaken = false;
        updatedLogs = currentLogs.filter((d) => d !== targetDate);
      } else {
        isTaken = true;
        updatedLogs = Array.from(new Set([...currentLogs, targetDate])).sort();
      }
    }

    const updated = await prisma.prescription.update({
      where: { id: prescriptionId, patientId: user.patient!.id },
      data: { usageLogs: updatedLogs },
    });

    // Record audit log for adherence tracking traceability
    await logAudit({
      userId: user.id,
      action: isTaken ? "MEDICATION_DOSE_TAKEN" : "MEDICATION_DOSE_UNMARKED",
      resourceType: "PRESCRIPTION",
      resourceId: prescriptionId,
      metadata: { date: targetDate, taken: isTaken },
    });

    return NextResponse.json({
      success: true,
      message: isTaken
        ? `Marked ${medication.medication} as taken for ${targetDate}`
        : `Unmarked ${medication.medication} for ${targetDate}`,
      action: isTaken ? "LOGGED" : "UNLOGGED",
      medicationId: prescriptionId,
      date: targetDate,
      taken: isTaken,
      usageLogs: updated.usageLogs,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("[POST /api/medications/[id]/usage]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
