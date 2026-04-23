import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";

const registerSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["PATIENT", "DOCTOR"]),
});

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
                  dateOfBirth: new Date("1990-01-01"),
                  gender: "Not specified",
                },
              },
            }
          : {
              doctor: {
                create: {
                  specialization: "General Practice",
                  licenseNumber: `TEMP-${Date.now()}`,
                  yearsOfExperience: 0,
                  consultationFee: 0,
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
        message: "Registration successful",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
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

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
