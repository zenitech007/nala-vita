import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── Input schema ────────────────────────────────────────

const riskScoreSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
});

// ─── POST: Compute patient risk score ────────────────────

export async function POST(req: NextRequest) {
  try {
    // Authenticate — doctors and admins only
    const supabase = createServerSupabaseClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    });

    if (!user || (user.role !== "DOCTOR" && user.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Only doctors and admins can request risk scores" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = riskScoreSchema.parse(body);

    // ─── Enforce doctor-patient relationship ─────────────
    // Admins can access any patient; doctors must have an existing
    // appointment with the patient (past or upcoming).
    if (user.role === "DOCTOR") {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      if (!doctor) {
        return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
      }

      const relationship = await prisma.appointment.findFirst({
        where: {
          doctorId: doctor.id,
          patientId: validated.patientId,
        },
        select: { id: true },
      });

      if (!relationship) {
        return NextResponse.json(
          { error: "You can only request risk scores for your own patients" },
          { status: 403 }
        );
      }
    }

    // ─── Fetch patient data ──────────────────────────────

    const patient = await prisma.patient.findUnique({
      where: { id: validated.patientId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        vitals: { orderBy: { recordedAt: "desc" }, take: 10 },
        prescriptions: { where: { isActive: true } },
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
    }

    // ─── Build context from real data ────────────────────

    const age = patient.dateOfBirth
      ? Math.floor(
          (Date.now() - new Date(patient.dateOfBirth).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000)
        )
      : null;

    const vitalsHistory =
      patient.vitals.length > 0
        ? patient.vitals
            .map(
              (v) =>
                `  [${new Date(v.recordedAt).toLocaleDateString()}] BP: ${v.bloodPressure ?? "N/A"}, HR: ${v.heartRate ?? "N/A"}, Temp: ${v.temperature ?? "N/A"}, SpO2: ${v.oxygenSaturation ?? "N/A"}, Sugar: ${v.bloodSugar ?? "N/A"}`
            )
            .join("\n")
        : "  No vitals recorded";

    const medications =
      patient.prescriptions.length > 0
        ? patient.prescriptions
            .map((p) => `  - ${p.medication} ${p.dosage} (${p.frequency})`)
            .join("\n")
        : "  None";

    const conditions =
      patient.allergies && patient.allergies.length > 0
        ? patient.allergies.map((a) => `  - ${a}`).join("\n")
        : "  None reported";

    const prompt = `You are a clinical risk assessment AI. Analyze the following patient data and compute a comprehensive health risk score.

Patient Profile:
- Name: ${patient.user.firstName} ${patient.user.lastName}
- Age: ${age ?? "Unknown"}
- Gender: ${patient.gender}
- Blood Type: ${patient.bloodType ?? "Unknown"}

Known Allergies / Conditions:
${conditions}

Current Medications:
${medications}

Recent Vitals History (last 10 readings, newest first):
${vitalsHistory}

Provide your assessment as a JSON object with exactly this structure:
{
  "riskScore": <number between 0 and 100>,
  "riskLevel": "Low" | "Moderate" | "High" | "Critical",
  "riskFactors": [
    {
      "factor": "Name of the risk factor",
      "severity": "Low" | "Moderate" | "High",
      "detail": "Brief explanation of why this is a risk factor"
    }
  ],
  "recommendedActions": [
    {
      "action": "Specific recommended action",
      "priority": "Immediate" | "Short-term" | "Long-term",
      "reason": "Why this action is recommended"
    }
  ],
  "summary": "A 2-3 sentence clinical summary of the patient's overall risk profile"
}

Scoring guidelines:
- 0-20: Low risk — stable patient, routine follow-up adequate
- 21-40: Moderate risk — some concerning trends, closer monitoring advised
- 41-70: High risk — active issues requiring intervention
- 71-100: Critical risk — immediate medical attention may be needed

Provide 3-6 risk factors and 3-5 recommended actions. Be specific and evidence-based.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert clinical risk assessment AI. You analyze patient data to compute evidence-based health risk scores. You always return valid JSON. Your assessments are used by licensed healthcare professionals for decision support, not as a standalone diagnostic tool.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1500,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();

    if (!responseText) {
      return NextResponse.json(
        { error: "No response from AI model" },
        { status: 502 }
      );
    }

    const result = JSON.parse(responseText);

    return NextResponse.json({
      patientId: validated.patientId,
      patientName: `${patient.user.firstName} ${patient.user.lastName}`,
      ...result,
      computedAt: new Date().toISOString(),
      disclaimer:
        "This risk score is generated by an AI model for clinical decision support purposes only. It should be interpreted by a qualified healthcare professional in the context of the patient's full medical history.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }

    console.error("POST /api/ai/risk-score error:", error);
    return NextResponse.json(
      { error: "Failed to compute risk score" },
      { status: 500 }
    );
  }
}
