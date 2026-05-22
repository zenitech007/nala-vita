import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ─── Shared base fields ───────────────────────────────────

const baseSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["PATIENT", "DOCTOR"]),
});

// ─── Patient-specific fields ──────────────────────────────

const patientSchema = baseSchema.extend({
  role: z.literal("PATIENT"),
  dateOfBirth: z.string().date("Date of birth must be in YYYY-MM-DD format"),
  gender: z.string().min(1, "Gender is required"),
});

// ─── Doctor-specific fields ───────────────────────────────

const doctorSchema = baseSchema.extend({
  role: z.literal("DOCTOR"),
  licenseNumber: z
    .string()
    .min(3, "License number must be at least 3 characters")
    .regex(/^[A-Z0-9\-]+$/i, "License number may only contain letters, numbers and hyphens"),
  specialization: z.string().min(2, "Specialization is required"),
  yearsOfExperience: z
    .number()
    .int()
    .min(0, "Years of experience must be 0 or more")
    .max(60, "Years of experience must be 60 or less"),
  consultationFee: z
    .number()
    .min(0, "Consultation fee must be 0 or more")
    .max(10_000, "Consultation fee seems too high"),
  bio: z.string().optional(),
});

const registerSchema = z.discriminatedUnion("role", [patientSchema, doctorSchema]);

// ─── POST: Register a new user ────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = registerSchema.parse(body);

    // Check if user already exists in Prisma
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Doctor-specific: ensure license number is not already taken
    if (validated.role === "DOCTOR") {
      const existingDoctor = await prisma.doctor.findUnique({
        where: { licenseNumber: validated.licenseNumber },
      });
      if (existingDoctor) {
        return NextResponse.json(
          { error: "A doctor with this license number already exists" },
          { status: 409 }
        );
      }
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: validated.email,
        password: validated.password,
        email_confirm: true,
        user_metadata: {
          first_name: validated.firstName,
          last_name: validated.lastName,
          role: validated.role,
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create auth user" },
        { status: 400 }
      );
    }

    // Create User record in Prisma with the role-specific relation
    const user = await prisma.user.create({
      data: {
        supabaseId: authData.user.id,
        email: validated.email,
        firstName: validated.firstName,
        lastName: validated.lastName,
        phone: validated.phone || null,
        role: validated.role,
        emailVerified: true,
        ...(validated.role === "PATIENT"
          ? {
              patient: {
                create: {
                  dateOfBirth: new Date(validated.dateOfBirth),
                  gender: validated.gender,
                },
              },
            }
          : {
              doctor: {
                create: {
                  specialization: validated.specialization,
                  licenseNumber: validated.licenseNumber,
                  yearsOfExperience: validated.yearsOfExperience,
                  consultationFee: validated.consultationFee,
                  bio: validated.bio || null,
                  // Doctors are unverified until an admin manually verifies them
                  isVerified: false,
                },
              },
            }),
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    return NextResponse.json(
      {
        message:
          validated.role === "DOCTOR"
            ? "Registration successful. Your account is pending admin verification before you can see patients."
            : "Registration successful",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          ...(user.doctor ? { isVerified: user.doctor.isVerified } : {}),
        },
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

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Registration error:", message, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
