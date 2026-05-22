import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function computeNextDoseAt(frequency: string): string | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const timeSlots: Record<string, number[]> = {
    "Once daily": [8],
    "Twice daily": [8, 20],
    "Three times daily": [8, 14, 20],
  };

  const slots = timeSlots[frequency];
  if (!slots) return null;

  for (const hour of slots) {
    const doseTime = new Date(today);
    doseTime.setHours(hour, 0, 0, 0);
    if (doseTime > now) return doseTime.toISOString();
  }

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(slots[0], 0, 0, 0);
  return tomorrow.toISOString();
}

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

    const prescriptions = await prisma.prescription.findMany({
      where: { patientId: user.patient.id },
      orderBy: { prescribedAt: "desc" },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    const medications = prescriptions.map((p) => ({
      ...p,
      nextDoseAt: p.isActive ? computeNextDoseAt(p.frequency) : null,
    }));

    return NextResponse.json(medications);
  } catch (error) {
    console.error("[GET /api/medications]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
