import { doctorHasPatientAccess } from "@/lib/access-control";
import { requireApiUser } from "@/lib/auth";
import { loadVisiblePatientRecord } from "@/lib/visible-patient-record";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { moneyForJson } from "@/lib/money";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── Helper: Authenticate and get user ───────────────────

// ─── GET: Single appointment with full patient EHR context ─

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR"] });
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const target = await prisma.appointment.findUnique({ where: { id }, select: { id: true, patientId: true, doctorId: true } });
    if (!target) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    if (!(user.role === "PATIENT" && user.patient?.id === target.patientId) && !(user.role === "DOCTOR" && user.doctor?.id === target.doctorId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const record = await loadVisiblePatientRecord(user, target.patientId);
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: { doctor: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } }, payment: true } });
    return NextResponse.json(moneyForJson({ appointment: { ...appointment, patient: { ...record.patient, vitals: record.vitals, prescriptions: record.prescriptions, labOrders: record.labOrders, medicalNotes: record.medicalNotes }, accessLimited: record.accessLimited, profileAvailable: record.profileAvailable } }));
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
    const { id } = await params;
    const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR"] });
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const appointment = await prisma.appointment.findUnique({
      where: { id }, select: { id: true, patientId: true, doctorId: true, status: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Authorization
    const isPatient = user.patient?.id === appointment.patientId;
    const isDoctor = user.doctor?.id === appointment.doctorId;


    if (!isPatient && !isDoctor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (isDoctor && !await doctorHasPatientAccess(user.doctor!.id, appointment.patientId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
      where: { id },
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
          select: {
            id: true,
            user: {
              select: { firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    return NextResponse.json(moneyForJson({ appointment: updated }));
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
    const { id } = await params;
    const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR"] });
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const appointment = await prisma.appointment.findUnique({
      where: { id }, select: { id: true, patientId: true, doctorId: true, status: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Authorization
    const isPatient = user.patient?.id === appointment.patientId;
    const isDoctor = user.doctor?.id === appointment.doctorId;


    if (!isPatient && !isDoctor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cannot cancel an already completed or cancelled appointment
    if (["COMPLETED", "CANCELLED"].includes(appointment.status)) {
      return NextResponse.json(
        { error: `Cannot cancel an appointment that is already ${appointment.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    if (isDoctor && !await doctorHasPatientAccess(user.doctor!.id, appointment.patientId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const validated = deleteSchema.parse(body);

    const cancelled = await prisma.appointment.update({
      where: { id },
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
