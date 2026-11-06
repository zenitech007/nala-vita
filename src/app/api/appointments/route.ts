import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { appointmentAvailabilityError } from "@/lib/appointment-availability";
import { AppointmentConflict, reserveAppointmentSlot } from "@/lib/appointment-lock";
import { Prisma } from "@prisma/client";
import { moneyForJson } from "@/lib/money";

// ─── GET: Fetch logged-in patient's appointments ─────────

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR"] });
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status"); // upcoming | past | cancelled

    // Build status conditions based on tab filter
    let statusCondition: object;
    switch (statusFilter) {
      case "past":
        statusCondition = { status: { in: ["COMPLETED", "NO_SHOW"] } };
        break;
      case "cancelled":
        statusCondition = { status: "CANCELLED" };
        break;
      default: // upcoming
        statusCondition = { status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] } };
        break;
    }

    // Determine whether to query as patient or doctor
    const isDoctor = user.role === "DOCTOR" && user.doctor;
    const roleFilter = isDoctor
      ? { doctorId: user.doctor!.id }
      : { patientId: user.patient?.id };

    const appointments = await prisma.appointment.findMany({
      where: {
        ...roleFilter,
        ...statusCondition,
      },
      include: {
        doctor: {
          include: {
            user: {
              select: { firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
        patient: { select: { id: true, user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
      },
      orderBy: { scheduledAt: statusFilter === "past" ? "desc" : "asc" },
    });

    return NextResponse.json(moneyForJson({ appointments }));
  } catch (error) {
    console.error("GET /api/appointments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST: Create a new appointment ──────────────────────

const createAppointmentSchema = z.object({
  doctorId: z.string().min(1, "Doctor is required"),
  scheduledAt: z.string().datetime("Invalid date"),
  consultationType: z.enum(["IN_PERSON", "VIDEO", "PHONE", "CHAT"]),
  urgencyLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  reason: z.string().optional(),
  duration: z.number().int().min(15).max(120).optional(),
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

    if (!user?.patient) {
      return NextResponse.json({ error: "Patient profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const validated = createAppointmentSchema.parse(body);

    if (!user.isActive || user.role !== "PATIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify doctor exists
    const doctor = await prisma.doctor.findUnique({
      where: { id: validated.doctorId },
      include: { user: { select: { isActive: true } } },
    });

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    const scheduledDate = new Date(validated.scheduledAt);
    const duration = validated.duration || 30;
    const availabilityError = appointmentAvailabilityError(doctor, scheduledDate, duration);
    if (availabilityError) return NextResponse.json({ error: availabilityError }, { status: 422 });

    // Create appointment and pending payment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      await reserveAppointmentSlot(tx, doctor.id, user.patient!.id, scheduledDate, duration);
      const appointment = await tx.appointment.create({
        data: {
          patientId: user.patient!.id,
          doctorId: validated.doctorId,
          authoredByDoctorId: validated.doctorId,
          scheduledAt: scheduledDate,
          duration,
          consultationType: validated.consultationType,
          urgencyLevel: validated.urgencyLevel || "LOW",
          reason: validated.reason || null,
          status: "SCHEDULED",
        },
        include: {
          doctor: {
            include: {
              user: {
                select: { firstName: true, lastName: true, avatarUrl: true },
              },
            },
          },
        },
      });

      // Create pending payment record
      const payment = await tx.payment.create({
        data: {
          patientId: user.patient!.id,
          appointmentId: appointment.id,
          amount: new Prisma.Decimal(doctor.consultationFee).plus(2), // exact fee + platform fee
          currency: "USD",
          status: "PENDING",
        },
      });

      return { appointment, payment };
    }, { isolationLevel: "ReadCommitted" });

    return NextResponse.json(
      moneyForJson({
        message: "Appointment booked successfully",
        appointment: result.appointment,
        payment: result.payment,
      }),
      { status: 201 }
    );
  } catch (error) {
    // Exclusion violations protect every writer once the forward migration is applied.
    const databaseError = error as { code?: string; meta?: { code?: string; database_error?: string } };
    if (error instanceof AppointmentConflict || databaseError.code === "23P01"
      || databaseError.meta?.code === "23P01" || databaseError.meta?.database_error?.includes("appointments_no_")) {
      return NextResponse.json({ error: "This doctor or patient already has an overlapping appointment" }, { status: 409 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }

    console.error("POST /api/appointments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
