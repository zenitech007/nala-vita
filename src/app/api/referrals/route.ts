import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createNotification } from "@/lib/notifications";

// ─── POST: Create a referral ─────────────────────────────

const createReferralSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  referredDoctorId: z.string().min(1, "Receiving doctor is required"),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional(),
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
        { error: "Only doctors can create referrals" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = createReferralSchema.parse(body);

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: validated.patientId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // Verify receiving doctor exists and is not the same doctor
    const receivingDoctor = await prisma.doctor.findUnique({
      where: { id: validated.referredDoctorId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (!receivingDoctor) {
      return NextResponse.json(
        { error: "Receiving doctor not found" },
        { status: 404 }
      );
    }

    if (receivingDoctor.id === user.doctor.id) {
      return NextResponse.json(
        { error: "Cannot refer a patient to yourself" },
        { status: 400 }
      );
    }

    // Create referral
    const referral = await prisma.referral.create({
      data: {
        patientId: validated.patientId,
        referringDoctorId: user.doctor.id,
        referredDoctorId: validated.referredDoctorId,
        reason: validated.reason,
        notes: validated.notes || null,
        status: "PENDING",
      },
      include: {
        patient: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        referringDoctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        referredDoctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    // Send notification to the receiving doctor
    await createNotification(
      receivingDoctor.user.id,
      "New Referral Received",
      `Dr. ${user.firstName} ${user.lastName} has referred patient ${patient.user.firstName} ${patient.user.lastName} to you. Reason: ${validated.reason}`,
      "REFERRAL",
      { link: "/doctor/referrals" }
    );

    // Send notification to the patient
    await createNotification(
      patient.user.id,
      "You Have Been Referred",
      `Dr. ${user.firstName} ${user.lastName} has referred you to Dr. ${receivingDoctor.user.firstName} ${receivingDoctor.user.lastName} for: ${validated.reason}`,
      "REFERRAL",
      { link: "/patient/appointments" }
    );

    return NextResponse.json(
      { message: "Referral created successfully", referral },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("POST /api/referrals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── GET: List referrals for the authenticated doctor ────

export async function GET(_req: NextRequest) {
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
        { error: "Only doctors can view referrals" },
        { status: 403 }
      );
    }

    const doctorId = user.doctor.id;

    // Fetch sent referrals (where this doctor is the referring doctor)
    const sent = await prisma.referral.findMany({
      where: { referringDoctorId: doctorId },
      include: {
        patient: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        referredDoctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch received referrals (where this doctor is the referred doctor)
    const received = await prisma.referral.findMany({
      where: { referredDoctorId: doctorId },
      include: {
        patient: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        referringDoctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ sent, received });
  } catch (error) {
    console.error("GET /api/referrals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── PATCH: Accept or decline a referral ─────────────────

const patchReferralSchema = z.object({
  referralId: z.string().min(1),
  action: z.enum(["ACCEPTED", "DECLINED"]),
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
      include: { doctor: true },
    });

    if (!user?.doctor) {
      return NextResponse.json(
        { error: "Only doctors can update referrals" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = patchReferralSchema.parse(body);

    // Verify the referral belongs to this doctor (as the receiving doctor)
    const referral = await prisma.referral.findFirst({
      where: {
        id: validated.referralId,
        referredDoctorId: user.doctor.id,
        status: "PENDING",
      },
      include: {
        patient: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        referringDoctor: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!referral) {
      return NextResponse.json(
        { error: "Referral not found or already processed" },
        { status: 404 }
      );
    }

    // Update referral status
    const updated = await prisma.referral.update({
      where: { id: validated.referralId },
      data: { status: validated.action },
    });

    const actionLabel = validated.action === "ACCEPTED" ? "accepted" : "declined";

    // Notify the referring doctor
    await createNotification(
      referral.referringDoctor.user.id,
      `Referral ${actionLabel}`,
      `Dr. ${user.firstName} ${user.lastName} has ${actionLabel} your referral for patient ${referral.patient.user.firstName} ${referral.patient.user.lastName}.`,
      "REFERRAL",
      { link: "/doctor/referrals" }
    );

    // Notify the patient
    await createNotification(
      referral.patient.user.id,
      `Referral ${actionLabel}`,
      `Dr. ${user.firstName} ${user.lastName} has ${actionLabel} the referral from Dr. ${referral.referringDoctor.user.firstName} ${referral.referringDoctor.user.lastName}.`,
      "REFERRAL",
      { link: "/patient/appointments" }
    );

    return NextResponse.json({
      message: `Referral ${actionLabel} successfully`,
      referral: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("PATCH /api/referrals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
