import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendAppEmail } from "@/lib/otp-channel";
import { readBoundedJson } from "@/lib/bounded-body";

const schema = z.object({
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
  reason: z.string().trim().min(3).max(1000),
  expectedUpdatedAt: z.string().datetime(),
});
class LostReviewRace extends Error {}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser({ roles: ["ADMIN"], profile: "admin" });
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const input = schema.parse(await readBoundedJson(req, 8192));
    const doctor = await prisma.doctor.findUnique({
      where: { id }, include: { user: { select: { id: true, email: true, emailVerified: true } } },
    });
    if (!doctor) return NextResponse.json({ error: "Doctor not found." }, { status: 404 });
    await prisma.$transaction(async tx => {
      const changed = await tx.doctor.updateMany({
        where: { id, updatedAt: new Date(input.expectedUpdatedAt) },
        data: { isVerified: input.status === "VERIFIED" },
      });
      if (!changed.count) throw new LostReviewRace();
      const decision = { status: input.status, reason: input.reason, reviewerId: auth.user.id, reviewedAt: new Date() };
      await tx.doctorVerification.upsert({ where: { doctorId: id }, create: { doctorId: id, ...decision }, update: decision });
      await logAudit({
        userId: auth.user.id, action: "DOCTOR_VERIFICATION", resourceType: "DOCTOR", resourceId: id,
        metadata: { status: input.status, role: "DOCTOR" },
      }, { client: tx, required: true });
    });
    let emailStatus: "sent" | "unavailable" = "unavailable";
    if (doctor.user.email && doctor.user.emailVerified) {
      try {
        await sendAppEmail(doctor.user.email, "Nala Vita clinician verification",
          `Your clinician verification status is ${input.status.toLowerCase()}.\n\nReview reason: ${input.reason}\n\nSign in to review your account status.`);
        emailStatus = "sent";
      } catch {
        console.error(JSON.stringify({ event: "doctor.verification_email_failed" }));
      }
    }
    return NextResponse.json({ doctorId: id, status: input.status, emailStatus });
  } catch (error) {
    if (error instanceof LostReviewRace) return NextResponse.json({ error: "This record changed. Refresh before reviewing it again." }, { status: 409 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Choose a status and provide a review reason between 3 and 1000 characters." }, { status: 422 });
    console.error(JSON.stringify({ event: "doctor.verification_failed" }));
    return NextResponse.json({ error: "Could not save the verification decision." }, { status: 500 });
  }
}
