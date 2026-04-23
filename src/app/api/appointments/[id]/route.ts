import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface RouteParams {
  params: { id: string };
}

// ─── Helper: Authenticate and get user ───────────────────

async function getAuthenticatedUser() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  return prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    include: { patient: true, doctor: true },
  });
}

// ─── GET: Single appointment with full patient EHR context ─

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatarUrl: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        patient: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatarUrl: true,
                email: true,
                phone: true,
              },
            },
            vitals: { orderBy: { recordedAt: "desc" }, take: 5 },
            prescriptions: {
              where: { isActive: true },
              orderBy: { prescribedAt: "desc" },
              take: 10,
            },
            labOrders: {
              orderBy: { orderedAt: "desc" },
              take: 5,
              include: { results: true },
            },
            medicalNotes: { orderBy: { createdAt: "desc" }, take: 10 },
          },
        },
        payment: true,
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Authorization: only the involved patient or doctor can access
    const isPatient = user.patient?.id === appointment.patientId;
    const isDoctor = user.doctor?.id === appointment.doctorId;
    const isAdmin = user.role === "ADMIN";

    if (!isPatient && !isDoctor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ appointment });
  } catch (error) {
    console.error("GET /api/appointments/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── PATCH: Update appointment status and notes ──────────

const updateSchema = z.object({
  status: z
    .enum(["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"])
    .optional(),
  notes: z.string().optional(),
  cancellationReason: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Authorization
    const isPatient = user.patient?.id === appointment.patientId;
    const isDoctor = user.doctor?.id === appointment.doctorId;
    const isAdmin = user.role === "ADMIN";

    if (!isPatient && !isDoctor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const validated = updateSchema.parse(body);

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (validated.status) {
      updateData.status = validated.status;

      // If cancelling, require or store cancellation reason
      if (validated.status === "CANCELLED" && validated.cancellationReason) {
        updateData.cancellationReason = validated.cancellationReason;
      }
    }

    if (validated.notes !== undefined) {
      updateData.notes = validated.notes;
    }

    const updated = await prisma.appointment.update({
      where: { id: params.id },
      data: updateData,
      include: {
        doctor: {
          include: {
            user: {
              select: { firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
        patient: {
          include: {
            user: {
              select: { firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ appointment: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("PATCH /api/appointments/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE: Cancel appointment with reason ──────────────

const deleteSchema = z.object({
  cancellationReason: z.string().min(1, "Cancellation reason is required"),
});

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Authorization
    const isPatient = user.patient?.id === appointment.patientId;
    const isDoctor = user.doctor?.id === appointment.doctorId;
    const isAdmin = user.role === "ADMIN";

    if (!isPatient && !isDoctor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cannot cancel an already completed or cancelled appointment
    if (["COMPLETED", "CANCELLED"].includes(appointment.status)) {
      return NextResponse.json(
        { error: `Cannot cancel an appointment that is already ${appointment.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validated = deleteSchema.parse(body);

    const cancelled = await prisma.appointment.update({
      where: { id: params.id },
      data: {
        status: "CANCELLED",
        cancellationReason: validated.cancellationReason,
      },
    });

    return NextResponse.json({
      message: "Appointment cancelled successfully",
      appointment: cancelled,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("DELETE /api/appointments/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
