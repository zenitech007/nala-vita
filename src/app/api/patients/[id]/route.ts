import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    if (!user || user.role !== "DOCTOR" || !user.doctor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const doctorId = user.doctor.id;
    const patientId = id;

    const hasAppointment = await prisma.appointment.findFirst({
      where: { doctorId, patientId },
      select: { id: true },
    });

    const hasApprovedReferral = hasAppointment
      ? true
      : await prisma.referral.findFirst({
          where: {
            patientId,
            referredDoctorId: doctorId,
            status: "ACCEPTED",
          },
          select: { id: true },
        });

    if (!hasAppointment && !hasApprovedReferral) {
      return NextResponse.json(
        { error: "Forbidden: No authorized care relationship or approved record transfer" },
        { status: 403 }
      );
    }

    const [patient, vitals, prescriptions, labOrders, medicalNotes, referrals] =
      await Promise.all([
        prisma.patient.findUnique({
          where: { id: patientId },
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
        }),
        prisma.vital.findMany({
          where: { patientId },
          orderBy: { recordedAt: "desc" },
          take: 10,
        }),
        prisma.prescription.findMany({
          where: {
            patientId,
            OR: [
              { addedBy: "DOCTOR" },
              { isSharedWithDoctor: true },
            ],
          },
          include: {
            doctor: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { prescribedAt: "desc" },
        }),
        prisma.labOrder.findMany({
          where: { patientId },
          orderBy: { orderedAt: "desc" },
          take: 5,
          include: { results: true },
        }),
        prisma.medicalNote.findMany({
          where: {
            patientId,
            OR: [{ isPrivate: false }, { doctorId }],
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            doctor: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        }),
        prisma.referral.findMany({
          where: { patientId },
          include: {
            referringDoctor: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
            referredDoctor: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        }),
      ]);

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "READ",
        resourceType: "PATIENT_RECORD",
        resourceId: patientId,
      },
    });

    const maskedPatient = {
      ...patient,
      insuranceNumber: patient.insuranceNumber
        ? "****" + patient.insuranceNumber.slice(-4)
        : null,
    };

    return NextResponse.json({
      patient: maskedPatient,
      vitals,
      prescriptions,
      labOrders,
      medicalNotes,
      referrals,
    });
  } catch (error) {
    console.error("[GET /api/patients/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
