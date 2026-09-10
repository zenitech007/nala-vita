import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const privacySchema = z.object({
  noteId: z.string().min(1, "Note ID is required"),
  isPrivate: z.boolean(),
});

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
      include: { patient: true },
    });

    if (!user || user.role !== "PATIENT" || !user.patient) {
      return NextResponse.json(
        { error: "Forbidden: Only patients can manage their record privacy" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = privacySchema.parse(body);

    const note = await prisma.medicalNote.findFirst({
      where: {
        id: validated.noteId,
        patientId: user.patient.id,
      },
    });

    if (!note) {
      return NextResponse.json(
        { error: "Medical note not found or not owned by your account" },
        { status: 404 }
      );
    }

    const updated = await prisma.medicalNote.update({
      where: { id: validated.noteId },
      data: { isPrivate: validated.isPrivate },
    });

    // Audit log for compliance & HIPAA traceability
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: validated.isPrivate ? "RESTRICT_RECORD" : "UNRESTRICT_RECORD",
        resourceType: "MEDICAL_NOTE",
        resourceId: validated.noteId,
        metadata: JSON.stringify({
          noteTitle: note.title,
          isPrivate: validated.isPrivate,
        }),
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      isPrivate: updated.isPrivate,
      message: updated.isPrivate
        ? "Record restricted. It is now hidden from transferred doctors and external providers."
        : "Record shared. It is now visible to your authorized healthcare team.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("[PATCH /api/patients/privacy]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
