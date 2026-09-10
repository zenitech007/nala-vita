import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createNotification } from "@/lib/notifications";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: prescriptionId } = await params;
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

    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        doctor: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    if (!prescription || prescription.patientId !== user.patient.id) {
      return NextResponse.json({ error: "Prescription not found" }, { status: 404 });
    }

    if (!prescription.doctor) {
      return NextResponse.json(
        { error: "Cannot request refill for self-added medications without a prescribing doctor" },
        { status: 400 }
      );
    }

    if (prescription.refillsUsed >= prescription.refillsAllowed) {
      return NextResponse.json({ error: "No refills remaining" }, { status: 400 });
    }

    await createNotification(
      prescription.doctor.user.id,
      "Refill Request",
      `Patient ${user.firstName} ${user.lastName} has requested a refill for ${prescription.medication}.`,
      "PRESCRIPTION",
      { link: `/doctor/prescriptions` }
    );

    return NextResponse.json({ message: "Refill request sent" });
  } catch (error) {
    console.error("[PATCH /api/medications/[id]/refill]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
