import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const moodSchema = z.object({
  mood: z.number().min(1).max(10),
  note: z.string().max(2000).optional().default(""),
});

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
      include: { patient: true },
    });

    if (!user || !user.patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const entries = await prisma.medicalNote.findMany({
      where: {
        patientId: user.patient.id,
        category: "MOOD_LOG",
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("[GET /api/mental-health]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    if (!user || !user.patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = moodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { mood, note } = parsed.data;
    const patientId = user.patient.id;

    const lastAppointment = await prisma.appointment.findFirst({
      where: { patientId },
      orderBy: { scheduledAt: "desc" },
      select: { doctorId: true },
    });

    if (!lastAppointment) {
      return NextResponse.json(
        { error: "No doctor associated. Please book an appointment first." },
        { status: 400 }
      );
    }

    const today = new Date();
    const dateStr = today.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const entry = await prisma.medicalNote.create({
      data: {
        patientId,
        doctorId: lastAppointment.doctorId,
        title: `Mood Log \u2014 ${dateStr}`,
        content: JSON.stringify({ mood, note }),
        category: "MOOD_LOG",
        isPrivate: true,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("[POST /api/mental-health]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
