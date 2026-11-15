import { requireApiUser } from "@/lib/auth";
import { doctorHasPatientAccess } from "@/lib/access-control";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";


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
    const auth = await requireApiUser({ roles: ["DOCTOR"], profile: "doctor" });
    if (!auth.ok) return auth.response;
    const user = auth.user;

    if (!await doctorHasPatientAccess(user.doctor!.id, id)) return NextResponse.json({error:'Forbidden'}, {status:403});

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
        doctorId: user.doctor!.id,
        authoredByDoctorId: user.doctor!.id, authoredByUserId: user.id,
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
