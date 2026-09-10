import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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
      include: { doctor: true },
    });

    if (!user || user.role !== "DOCTOR" || !user.doctor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const all = searchParams.get("all") === "true";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));
    const skip = (page - 1) * limit;

    const doctorId = user.doctor.id;

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

    let where: Record<string, unknown>;
    let patientIdList: string[] = [];

    if (all) {
      where = searchFilter;
    } else {
      const [apptPatientIds, refPatientIds] = await Promise.all([
        prisma.appointment.findMany({
          where: { doctorId },
          select: { patientId: true },
          distinct: ["patientId"],
        }),
        prisma.referral.findMany({
          where: { referredDoctorId: doctorId, status: "ACCEPTED" },
          select: { patientId: true },
          distinct: ["patientId"],
        }),
      ]);

      const idSet = new Set([
        ...apptPatientIds.map((a) => a.patientId),
        ...refPatientIds.map((r) => r.patientId),
      ]);
      patientIdList = Array.from(idSet);

      if (patientIdList.length === 0) {
        return NextResponse.json({ patients: [], total: 0, page, limit });
      }

      where = {
        id: { in: patientIdList },
        ...searchFilter,
      };
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
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
          appointments: {
            where: { doctorId },
            orderBy: { scheduledAt: "desc" },
            take: 1,
            select: { scheduledAt: true, status: true },
          },
        },
      }),
      prisma.patient.count({ where }),
    ]);

    const result = patients.map((p) => {
      const lastAppt = p.appointments[0] || null;
      return {
        id: p.id,
        dateOfBirth: p.dateOfBirth,
        gender: p.gender,
        bloodType: p.bloodType,
        allergies: p.allergies,
        user: p.user,
        lastAppointment: lastAppt
          ? { date: lastAppt.scheduledAt, status: lastAppt.status }
          : null,
        totalAppointments: p.appointments.length,
      };
    });

    // Get accurate total appointments count per patient
    const returnedPatientIds = patients.map((p) => p.id);
    const appointmentCounts = returnedPatientIds.length > 0
      ? await prisma.appointment.groupBy({
          by: ["patientId"],
          where: { doctorId, patientId: { in: returnedPatientIds } },
          _count: { id: true },
        })
      : [];

    const countMap = new Map(appointmentCounts.map((c) => [c.patientId, c._count.id]));

    const enriched = result.map((p) => ({
      ...p,
      totalAppointments: countMap.get(p.id) || 0,
    }));

    return NextResponse.json({ patients: enriched, total, page, limit });
  } catch (error) {
    console.error("[GET /api/patients]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST: Doctor/Clinic registers an in-person patient ───

const createPatientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
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

    const doctorUser = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      include: { doctor: true },
    });

    if (!doctorUser || doctorUser.role !== "DOCTOR" || !doctorUser.doctor) {
      return NextResponse.json(
        { error: "Forbidden: Only authorized doctors can intake patients" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = createPatientSchema.parse(body);

    const doctorId = doctorUser.doctor.id;

    // Check if user already exists
    let existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
      include: { patient: true },
    });

    if (!existingUser && validated.phone) {
      existingUser = await prisma.user.findFirst({
        where: { phone: validated.phone, role: "PATIENT" },
        include: { patient: true },
      });
    }

    let patientId: string;

    if (existingUser) {
      // User exists
      if (!existingUser.patient) {
        const newPatient = await prisma.patient.create({
          data: {
            userId: existingUser.id,
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
        });
        patientId = newPatient.id;
      } else {
        patientId = existingUser.patient.id;
      }
    } else {
      // Create provisional User and Patient record
      const provisionalSupabaseId = crypto.randomUUID();
      const newUser = await prisma.user.create({
        data: {
          supabaseId: provisionalSupabaseId,
          email: validated.email,
          firstName: validated.firstName,
          lastName: validated.lastName,
          phone: validated.phone || null,
          role: "PATIENT",
          emailVerified: false,
          patient: {
            create: {
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

    // Connect this doctor to the patient via an initial intake appointment
    await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        scheduledAt: new Date(),
        consultationType: "IN_PERSON",
        status: "CONFIRMED",
        reason: "Clinical Intake & Patient Registration",
        notes: validated.initialNotes || "In-person patient registered by healthcare provider.",
      },
    });

    // If initial notes provided, record a medical note
    if (validated.initialNotes?.trim()) {
      await prisma.medicalNote.create({
        data: {
          patientId,
          doctorId,
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
          "Patient registered successfully. They can claim online access anytime by signing up with their email or phone.",
        patient: patientRecord,
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
    console.error("[POST /api/patients]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

