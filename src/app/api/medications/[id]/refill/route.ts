import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const request = await prisma.$transaction(async tx => {
      const request = await tx.refillRequest.create({ data: { prescriptionId, requesterId: user.id } });
      await tx.notification.create({ data: {
        userId: prescription.doctor!.user.id, title: "Refill Request",
        message: `Patient ${user.firstName} ${user.lastName} requested a refill review.`,
        type: "PRESCRIPTION", link: "/doctor/prescriptions",
      } });
      return request;
    });
    return NextResponse.json({ message: "Refill review requested", request });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "A refill request is already pending" }, { status: 409 });
    console.error("[PATCH /api/medications/[id]/refill]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
