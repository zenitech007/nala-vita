import { requireApiUser } from "@/lib/auth";
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
    const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const prescription = await prisma.prescription.findFirst({
      where: { id: prescriptionId, patientId: user.patient!.id },
      include: {
        doctor: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    if (!prescription || prescription.patientId !== user.patient!.id) {
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
