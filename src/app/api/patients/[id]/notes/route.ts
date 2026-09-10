import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const createNoteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: z.string().optional(),
  isPrivate: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
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

    if (!user?.doctor) {
      return NextResponse.json({ error: "Only doctors can create medical notes" }, { status: 403 });
    }

    // Verify the patient exists
    const patient = await prisma.patient.findUnique({
      where: { id },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const body = await req.json();
    const validated = createNoteSchema.parse(body);

    const note = await prisma.medicalNote.create({
      data: {
        patientId: id,
        doctorId: user.doctor.id,
        title: validated.title,
        content: validated.content,
        category: validated.category || null,
        isPrivate: validated.isPrivate || false,
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("POST /api/patients/[id]/notes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
