import { workspacePatientWhere } from "@/lib/record-visibility";
import { loadVisiblePatientRecord } from "@/lib/visible-patient-record";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requireApiUser } from "@/lib/auth";
import { requestRecordAccess } from "@/lib/record-access-requests";
import { RECORD_SCOPES } from "@/lib/record-scope";
import { ConsentError } from "@/lib/record-access-requests";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["DOCTOR"], profile: "doctor" });
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));
    const skip = (page - 1) * limit;

    const doctorId = user.doctor!.id;

    const searchFilter = search
      ? {
          user: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
            ],
          },
        }
      : {};

    const where = { AND: [workspacePatientWhere(doctorId), searchFilter] };
    const [targets, total] = await Promise.all([
      prisma.patient.findMany({ where, select: { id: true }, skip, take: limit }), prisma.patient.count({ where }),
    ]);
    const enriched = await Promise.all(targets.map(async target => {
      const { patient, appointments, accessLimited, profileAvailable } = await loadVisiblePatientRecord(user, target.id);
      const last = appointments.filter(a => a.doctorId === doctorId)[0];
      return { ...patient, lastAppointment: last ? { date: last.scheduledAt, status: last.status } : null, totalAppointments: appointments.filter(a => a.doctorId === doctorId).length, accessLimited, profileAvailable };
    }));
    return NextResponse.json({ patients: enriched, total, page, limit });
  } catch (error) {
    console.error("[GET /api/patients]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST: Doctor/Clinic registers an in-person patient ───

const createPatientSchema = z.object({
  facilityId: z.string().min(1).optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().trim().email("Invalid email address").optional(),
  phone: z.string().trim().min(1).optional(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  bloodType: z.string().optional(),
  allergies: z.array(z.string()).optional().default([]),
  address: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insuranceNumber: z.string().optional(),
  initialNotes: z.string().optional(),
}).refine(value => !!(value.email || value.phone), "Provide an email or phone contact");

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["DOCTOR"], profile: "doctor" });
    if (!auth.ok) return auth.response;
    const doctorUser = auth.user;

    const body = await req.json();
    const validated = createPatientSchema.parse(body);

    const doctorId = doctorUser.doctor!.id;
    const facilityId = validated.facilityId ?? null;
    if (facilityId && !await prisma.facilityMembership.findFirst({ where: { doctorId, facilityId, isActive: true, facility: { isActive: true } } }))
      return NextResponse.json({ error: "Forbidden facility" }, { status: 403 });

    // Check if user already exists
    let existingUser = validated.email ? await prisma.user.findUnique({
      where: { email: validated.email },
      select: { id: true, role: true, patient: { select: { id: true, createdByDoctorId: true, createdByFacilityId: true } } },
    }) : null;

    if (!existingUser && validated.phone) {
      const phoneMatches = await prisma.user.findMany({
        where: { phone: validated.phone, role: "PATIENT" },
        select: { id: true, role: true, patient: { select: { id: true, createdByDoctorId: true, createdByFacilityId: true } } },
        take: 2,
      });
      if (phoneMatches.length > 1) return NextResponse.json({ error: "This phone matches multiple records. Confirm a unique email or ask the patient to use their clinic invitation." }, { status: 409 });
      existingUser = phoneMatches[0] ?? null;
    }

    let patientId: string;

    if (existingUser) {
      if (existingUser.role !== "PATIENT" || !existingUser.patient) return NextResponse.json({ error: "This contact is not eligible for patient intake" }, { status: 409 });
      const source = existingUser.patient.createdByFacilityId ? { sourceFacilityId: existingUser.patient.createdByFacilityId }
        : existingUser.patient.createdByDoctorId ? { sourceDoctorId: existingUser.patient.createdByDoctorId } : { sourceUserId: existingUser.id };
      const request = await requestRecordAccess(doctorUser, { patientId: existingUser.patient.id, scope: [...RECORD_SCOPES], requesterFacilityId: facilityId, ...source });
      return NextResponse.json({ request, message: "Patient approval requested. Existing records remain private. Submitted clinical details and initial notes have not been written." }, { status: 202 });
    } else {
      // Create provisional User and Patient record
      const newUser = await prisma.user.create({
        data: {
          supabaseId: null,
          email: validated.email ?? null,
          firstName: validated.firstName,
          lastName: validated.lastName,
          phone: validated.phone || null,
          role: "PATIENT",
          emailVerified: false,
          patient: {
            create: {
              createdByDoctorId: doctorId,
              createdByFacilityId: facilityId,
              dateOfBirth: new Date(validated.dateOfBirth),
              gender: validated.gender,
              bloodType: validated.bloodType || null,
              allergies: validated.allergies,
              address: validated.address || null,
              emergencyName: validated.emergencyName || null,
              emergencyPhone: validated.emergencyPhone || null,
              insuranceProvider: validated.insuranceProvider || null,
              insuranceNumber: validated.insuranceNumber || null,
            },
          },
        },
        include: { patient: true },
      });
      patientId = newUser.patient!.id;
    }

    // If initial notes provided, record a medical note
    if (validated.initialNotes?.trim()) {
      await prisma.medicalNote.create({
        data: {
          patientId,
          doctorId,
          authoredByDoctorId: doctorId,
          authoredByFacilityId: facilityId,
          title: "Intake & Clinical History",
          content: validated.initialNotes.trim(),
          category: "consultation",
          isPrivate: false,
        },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: doctorUser.id,
        action: "CLINIC_REGISTER_PATIENT",
        resourceType: "PATIENT_RECORD",
        resourceId: patientId,
        metadata: JSON.stringify({
          doctorId,
          email: validated.email,
          phone: validated.phone,
        }),
      },
    }).catch(() => {});

    const patientRecord = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message:
          "Patient registered successfully. They can claim online access by verifying the email on file, or with a clinic invitation and email verification.",
        patient: patientRecord,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ConsentError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("[POST /api/patients]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

