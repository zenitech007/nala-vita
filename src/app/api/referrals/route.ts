import { requireApiUser } from "@/lib/auth";
import { getCollectionVisibility } from "@/lib/record-visibility";
import { doctorHasPatientAccess } from "@/lib/access-control";
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
    const auth = await requireApiUser({ roles: ["DOCTOR"], profile: "doctor" });
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const body = await req.json();
    const validated = createReferralSchema.parse(body);

    if (!await doctorHasPatientAccess(user.doctor!.id, validated.patientId)) return NextResponse.json({error:'Forbidden'}, {status:403});

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
      include: { user: { select: { id: true, firstName: true, lastName: true, isActive: true } } },
    });

    if (!receivingDoctor || !receivingDoctor.isVerified || !receivingDoctor.user.isActive) {
      return NextResponse.json(
        { error: "Receiving doctor not found" },
        { status: 404 }
      );
    }

    if (receivingDoctor.id === user.doctor!.id) {
      return NextResponse.json(
        { error: "Cannot refer a patient to yourself" },
        { status: 400 }
      );
    }

    // Create referral
    const referral = await prisma.referral.create({
      data: {
        patientId: validated.patientId,
        referringDoctorId: user.doctor!.id,
        authoredByDoctorId: user.doctor!.id, authoredByUserId: user.id,
        referredDoctorId: validated.referredDoctorId,
        reason: validated.reason,
        notes: validated.notes || null,
        status: "PENDING",
      },
      include: {
        patient: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
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
      "A referral is pending. Request patient approval before accessing clinical details.",
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
    const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR"] });
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const access = await getCollectionVisibility(user, "REFERRALS");
    const referrals = await prisma.referral.findMany({ where: access.where("REFERRALS"), include: {
      patient: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      referringDoctor: { include: { user: { select: { firstName: true, lastName: true } } } },
      referredDoctor: { include: { user: { select: { firstName: true, lastName: true } } } },
    }, orderBy: { createdAt: "desc" } });
    await access.log("REFERRALS", referrals);
    if (user.role === "PATIENT") return NextResponse.json({ referrals });
    const received = await prisma.referral.findMany({ where: { referredDoctorId: user.doctor!.id }, select: { id: true, status: true, patientId: true, createdAt: true } });
    return NextResponse.json({ sent: referrals, received: received.map(item => ({ ...item, accessLimited: true, reason: "Request patient approval to view referral details", patient: { user: { firstName: "Patient", lastName: "" } } })) });
  } catch (error) {
    console.error("GET /api/referrals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── PATCH: Accept or decline a referral (By Doctor or Patient) ──

const patchReferralSchema = z.object({
  referralId: z.string().min(1),
  action: z.enum(["ACCEPTED", "DECLINED"]),
});

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR"] });
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const validated = patchReferralSchema.parse(await req.json());
    const owner = user.role === "PATIENT" ? { patientId: user.patient!.id } : { referredDoctorId: user.doctor!.id };
    const target = await prisma.referral.findFirst({ where: { id: validated.referralId, status: "PENDING", ...owner }, select: { id: true, patientId: true, referringDoctorId: true, referredDoctorId: true } });
    if (!target) return NextResponse.json({ error: "Referral not found or already processed" }, { status: 404 });
    if (user.role === "DOCTOR" && !await doctorHasPatientAccess(user.doctor!.id, target.patientId)) return NextResponse.json({ error: "Patient approval is required before acting on this referral. Request record access first." }, { status: 403 });
    const changed = await prisma.referral.updateMany({ where: { id: target.id, status: "PENDING", ...owner }, data: { status: validated.action } });
    if (changed.count !== 1) return NextResponse.json({ error: "Referral changed; refresh before retrying" }, { status: 409 });
    // Referral status is operational. It never creates a historical record grant.
    const doctors = await prisma.doctor.findMany({ where: { id: { in: [target.referringDoctorId, target.referredDoctorId] } }, select: { userId: true } });
    for (const doctor of doctors) await createNotification(doctor.userId, "Referral updated", `Referral ${validated.action.toLowerCase()}. Record access still requires separate patient approval.`, "REFERRAL", { link: "/doctor/record-access" });
    return NextResponse.json({ message: `Referral ${validated.action.toLowerCase()}. Record sharing requires a separate email-verified approval.`, referral: { id: target.id, status: validated.action } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    console.error("PATCH /api/referrals failed");
    return NextResponse.json({ error: "Unable to update referral" }, { status: 500 });
  }
}
