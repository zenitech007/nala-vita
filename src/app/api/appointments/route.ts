import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// ─── GET: Fetch logged-in patient's appointments ─────────

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
        patient: {
          include: {
            user: {
              select: { firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { scheduledAt: statusFilter === "past" ? "desc" : "asc" },
    });

    return NextResponse.json({ appointments });
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
  duration: z.number().min(15).max(120).optional(),
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

    // Verify doctor exists
    const doctor = await prisma.doctor.findUnique({
      where: { id: validated.doctorId },
    });

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    // Check for conflicting appointment: two intervals overlap when
    //   existingStart < newEnd  AND  existingEnd > newStart
    // Prisma doesn't know each appointment's duration directly, so we fetch
    // active appointments in the broad window and check overlap in JS.
    const scheduledDate = new Date(validated.scheduledAt);
    const duration = validated.duration || 30;
    const slotEnd = new Date(scheduledDate.getTime() + duration * 60_000);

    const broadWindowStart = new Date(scheduledDate.getTime() - 4 * 60 * 60 * 1000); // 4 h before
    const broadWindowEnd   = new Date(scheduledDate.getTime() + 4 * 60 * 60 * 1000); // 4 h after

    const activeInWindow = await prisma.appointment.findMany({
      where: {
        doctorId: validated.doctorId,
        status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
        scheduledAt: { gte: broadWindowStart, lte: broadWindowEnd },
      },
      select: { id: true, scheduledAt: true, duration: true },
    });

    const conflict = activeInWindow.find((appt) => {
      const existingStart = appt.scheduledAt.getTime();
      const existingEnd   = existingStart + appt.duration * 60_000;
      const newStart      = scheduledDate.getTime();
      const newEnd        = slotEnd.getTime();
      return existingStart < newEnd && existingEnd > newStart;
    });

    if (conflict) {
      return NextResponse.json(
        { error: "This time slot is not available. Please choose a different time." },
        { status: 409 }
      );
    }

    // Create appointment and pending payment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          patientId: user.patient!.id,
          doctorId: validated.doctorId,
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
          amount: doctor.consultationFee + 2, // fee + platform fee
          currency: "USD",
          status: "PENDING",
        },
      });

      return { appointment, payment };
    });

    return NextResponse.json(
      {
        message: "Appointment booked successfully",
        appointment: result.appointment,
        payment: result.payment,
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

    console.error("POST /api/appointments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
