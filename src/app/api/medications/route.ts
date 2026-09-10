import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createNotification } from "@/lib/notifications";

function computeNextDoseAt(frequency: string): string | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const timeSlots: Record<string, number[]> = {
    "Once daily": [8],
    "Twice daily": [8, 20],
    "Three times daily": [8, 14, 20],
    "Four times daily": [8, 12, 16, 20],
  };

  const slots = timeSlots[frequency] || [8];

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

// ─── GET: Role-Aware Medication & Adherence Progression Pipeline ─

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
      include: { patient: true, doctor: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // ─────────────────────────────────────────────────────────────
    // DOCTOR VIEW: 6 Months Adherence History & Privacy Filtering
    // ─────────────────────────────────────────────────────────────
    if (user.role === "DOCTOR" && user.doctor) {
      const patientId = searchParams.get("patientId");
      if (!patientId) {
        return NextResponse.json(
          { error: "patientId is required for doctor view" },
          { status: 400 }
        );
      }

      const doctorId = user.doctor.id;

      // Access Check: Active appointment or accepted referral
      const hasAppointment = await prisma.appointment.findFirst({
        where: { doctorId, patientId },
        select: { id: true },
      });

      const hasReferral = hasAppointment
        ? true
        : await prisma.referral.findFirst({
            where: { patientId, referredDoctorId: doctorId, status: "ACCEPTED" },
            select: { id: true },
          });

      if (!hasAppointment && !hasReferral) {
        return NextResponse.json(
          { error: "Forbidden: No authorized care relationship with patient" },
          { status: 403 }
        );
      }

      // 6-month threshold
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      // Query: Doctor medications + patient self-added WHERE isSharedWithDoctor === true
      const prescriptions = await prisma.prescription.findMany({
        where: {
          patientId,
          AND: [
            {
              OR: [
                { addedBy: "DOCTOR" },
                { isSharedWithDoctor: true },
              ],
            },
            {
              OR: [
                { prescribedAt: { gte: sixMonthsAgo } },
                { isActive: true },
              ],
            },
          ],
        },
        orderBy: { prescribedAt: "desc" },
        include: {
          doctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      // Filter usageLogs strictly to the last 6 months (180 days)
      const sixMonthsDays: string[] = [];
      for (let i = 180; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        sixMonthsDays.push(d.toISOString().split("T")[0]);
      }

      let totalExpectedDoses = 0;
      let totalLoggedDoses = 0;

      const enriched = prescriptions.map((p) => {
        const logs = Array.isArray(p.usageLogs) ? p.usageLogs : [];
        const sixMonthLogs = logs.filter((logEntry) => {
          const dateStr = logEntry.includes("T") ? logEntry.split("T")[0] : logEntry;
          return dateStr >= sixMonthsDays[0] && dateStr <= todayStr;
        });

        const loggedCount = sixMonthLogs.length;
        totalLoggedDoses += loggedCount;

        // Estimate adherence percentage based on active days (max 180 days)
        const pDate = new Date(p.prescribedAt);
        const daysActive = Math.min(
          180,
          Math.max(1, Math.floor((now.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24)))
        );
        totalExpectedDoses += daysActive;

        const adherenceRate = Math.min(100, Math.round((loggedCount / daysActive) * 100));

        return {
          ...p,
          usageLogs: sixMonthLogs,
          nextDoseAt: p.isActive ? computeNextDoseAt(p.frequency) : null,
          adherenceRate,
          totalLoggedDoses: loggedCount,
          daysTracked: daysActive,
        };
      });

      const overallAdherence =
        totalExpectedDoses > 0
          ? Math.min(100, Math.round((totalLoggedDoses / totalExpectedDoses) * 100))
          : 0;

      return NextResponse.json({
        medications: enriched,
        adherenceStats: {
          window: "6_months",
          overallAdherenceRate: overallAdherence,
          totalLoggedDoses,
          activeMedicationsCount: enriched.filter((m) => m.isActive).length,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // PATIENT VIEW: 7 Days Adherence History & Daily Tracker Strip
    // ─────────────────────────────────────────────────────────────
    if (user.patient) {
      const patientId = user.patient.id;

      // 7-day calendar window
      const last7Days: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        last7Days.push(d.toISOString().split("T")[0]);
      }

      // Patient sees all their prescribed + self-added medications
      const prescriptions = await prisma.prescription.findMany({
        where: { patientId },
        orderBy: { prescribedAt: "desc" },
        include: {
          doctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      let totalLogged7Days = 0;
      const totalPossible7Days = prescriptions.length * 7;

      const enriched = prescriptions.map((p) => {
        const logs = Array.isArray(p.usageLogs) ? p.usageLogs : [];
        const sevenDayLogs = logs.filter((logEntry) => {
          const dateStr = logEntry.includes("T") ? logEntry.split("T")[0] : logEntry;
          return last7Days.includes(dateStr);
        });

        const takenDaysCount = new Set(
          sevenDayLogs.map((l) => (l.includes("T") ? l.split("T")[0] : l))
        ).size;

        totalLogged7Days += takenDaysCount;

        const takenToday = sevenDayLogs.some((l) => {
          const dateStr = l.includes("T") ? l.split("T")[0] : l;
          return dateStr === todayStr;
        });

        const adherenceRate7Days = Math.round((takenDaysCount / 7) * 100);

        return {
          ...p,
          usageLogs: sevenDayLogs, // strictly filtered to last 7 days
          last7DaysLogs: sevenDayLogs,
          nextDoseAt: p.isActive ? computeNextDoseAt(p.frequency) : null,
          takenToday,
          adherenceRate7Days,
          takenDaysCount,
        };
      });

      const weeklyAdherence =
        totalPossible7Days > 0
          ? Math.round((totalLogged7Days / totalPossible7Days) * 100)
          : 0;

      return NextResponse.json({
        medications: enriched,
        last7Days,
        today: todayStr,
        adherenceStats: {
          window: "7_days",
          weeklyAdherenceRate: weeklyAdherence,
          totalLogged7Days,
          totalPrescriptions: prescriptions.length,
        },
      });
    }

    return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
  } catch (error) {
    console.error("[GET /api/medications]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST: Doctor Prescribes or Patient Adds Manual Medication ──

const doctorPrescribeSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  medication: z.string().min(1, "Medication name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  duration: z.string().min(1, "Duration is required"),
  instructions: z.string().optional(),
  refillsAllowed: z.number().min(0).max(12).optional().default(0),
  expiresAt: z.string().datetime().optional(),
});

const patientAddSchema = z.object({
  medication: z.string().min(1, "Medication name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  duration: z.string().optional().default("Ongoing"),
  instructions: z.string().optional(),
  isSharedWithDoctor: z.boolean().optional().default(true),
});

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
      include: { patient: true, doctor: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();

    // ─────────────────────────────────────────────────────────────
    // DOCTOR PRESCRIBES MEDICATION
    // ─────────────────────────────────────────────────────────────
    if (user.role === "DOCTOR" && user.doctor) {
      const validated = doctorPrescribeSchema.parse(body);

      const patient = await prisma.patient.findUnique({
        where: { id: validated.patientId },
        include: { user: true },
      });

      if (!patient) {
        return NextResponse.json({ error: "Patient not found" }, { status: 404 });
      }

      const prescription = await prisma.prescription.create({
        data: {
          patientId: validated.patientId,
          doctorId: user.doctor.id,
          medication: validated.medication,
          dosage: validated.dosage,
          frequency: validated.frequency,
          duration: validated.duration,
          instructions: validated.instructions || null,
          refillsAllowed: validated.refillsAllowed || 0,
          expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
          isActive: true,
          addedBy: "DOCTOR",
          isSharedWithDoctor: true,
          usageLogs: [],
        },
        include: {
          doctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      // Send notification to patient
      await createNotification(
        patient.userId,
        "New Medication Prescribed",
        `Dr. ${user.firstName} ${user.lastName} has prescribed ${validated.medication} (${validated.dosage}). View it in your Medications schedule.`,
        "PRESCRIPTION",
        { link: "/patient/medications" }
      );

      // Audit Log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "DOCTOR_PRESCRIBE_MEDICATION",
          resourceType: "PRESCRIPTION",
          resourceId: prescription.id,
          metadata: JSON.stringify({
            patientId: validated.patientId,
            medication: validated.medication,
          }),
        },
      }).catch(() => {});

      return NextResponse.json(
        {
          message: "Medication assigned to patient successfully",
          medication: prescription,
        },
        { status: 201 }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // PATIENT ADDS MANUAL MEDICATION / SUPPLEMENT
    // ─────────────────────────────────────────────────────────────
    if (user.patient) {
      const validated = patientAddSchema.parse(body);

      const prescription = await prisma.prescription.create({
        data: {
          patientId: user.patient.id,
          doctorId: null,
          medication: validated.medication,
          dosage: validated.dosage,
          frequency: validated.frequency,
          duration: validated.duration || "Ongoing",
          instructions: validated.instructions || null,
          refillsAllowed: 0,
          isActive: true,
          addedBy: "PATIENT",
          isSharedWithDoctor: validated.isSharedWithDoctor ?? true,
          usageLogs: [],
        },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "PATIENT_ADD_MEDICATION",
          resourceType: "PRESCRIPTION",
          resourceId: prescription.id,
          metadata: JSON.stringify({
            medication: validated.medication,
            isSharedWithDoctor: validated.isSharedWithDoctor,
          }),
        },
      }).catch(() => {});

      return NextResponse.json(
        {
          message: "Personal medication added to your schedule",
          medication: prescription,
        },
        { status: 201 }
      );
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("[POST /api/medications]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
