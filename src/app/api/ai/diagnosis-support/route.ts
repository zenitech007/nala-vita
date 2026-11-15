import {diagnosisAssessmentSchema,parseClinicalAssessment,clinicalAssessmentUnavailable} from "@/lib/clinical-ai-response";
import { ProviderTimeoutError, providerTimeoutResponse, withProviderDeadline } from "@/lib/provider-deadline";
import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ai, GEMINI_MODEL } from "@/lib/gemini";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { temperatureToCelsius, formatTemperature } from "@/lib/temperature";

// ─── Input schema ────────────────────────────────────────

const diagnosisSupportSchema = z.object({
  symptoms: z.array(z.string()).min(1, "At least one symptom is required"),
  vitals: z.object({
    bloodPressure: z.string().optional(),
    heartRate: z.number().optional(),
    temperature: z.number().optional(),
    temperatureUnit: z.enum(["C", "F"]).optional(),
    respiratoryRate: z.number().optional(),
    oxygenSaturation: z.number().optional(),
    bloodSugar: z.number().optional(),
  }).refine(value => (value.temperature === undefined) === (value.temperatureUnit === undefined), "Temperature requires an explicit C or F unit").optional(),
  history: z.array(z.string()).optional(),
  currentMedications: z.array(z.string()).optional(),
  patientAge: z.number().optional(),
  patientGender: z.string().optional(),
});

// ─── POST: Clinical decision support ─────────────────────

export async function POST(req: NextRequest) {
  try {
    // Authenticate — only doctors may use this endpoint
    const auth = await requireApiUser({ roles: ["DOCTOR"], profile: "doctor" });
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const limit = await checkRateLimitAsync(`ai:diagnosis-support:${user.id}`);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests. Please wait before trying again.",
          retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(limit.resetAt),
          },
        }
      );
    }

    const body = await req.json();
    const validated = diagnosisSupportSchema.parse(body);

    // ─── Build prompt ────────────────────────────────────

    const vitalsText = validated.vitals
      ? Object.entries(validated.vitals)
          .filter(([k, v]) => k !== "temperatureUnit" && v !== undefined && v !== null && v !== "")
          .map(([k, v]) => `  - ${k}: ${k === "temperature" ? formatTemperature(temperatureToCelsius(v as number, validated.vitals!.temperatureUnit!), "C") : v}`)
          .join("\n") || "  None recorded"
      : "  None recorded";

    const historyText =
      validated.history && validated.history.length > 0
        ? validated.history.map((h) => `  - ${h}`).join("\n")
        : "  None reported";

    const medsText =
      validated.currentMedications && validated.currentMedications.length > 0
        ? validated.currentMedications.map((m) => `  - ${m}`).join("\n")
        : "  None reported";

    const prompt = `You are an AI clinical decision support system assisting a licensed physician during a consultation. Analyze the following patient data and provide a structured clinical assessment.

Patient Information:
- Age: ${validated.patientAge ?? "Unknown"}
- Gender: ${validated.patientGender ?? "Unknown"}

Presenting Symptoms:
${validated.symptoms.map((s) => `  - ${s}`).join("\n")}

Current Vitals:
${vitalsText}

Medical History:
${historyText}

Current Medications:
${medsText}

Provide your analysis as a JSON object with exactly this structure:
{
  "differentialDiagnosis": [
    {
      "condition": "Condition name",
      "probability": "High" | "Medium" | "Low",
      "reasoning": "Brief clinical reasoning for this differential"
    }
  ],
  "drugInteractions": [
    {
      "drugs": ["Drug A", "Drug B"],
      "severity": "Major" | "Moderate" | "Minor",
      "description": "Description of the interaction and clinical significance"
    }
  ],
  "suggestedTests": [
    {
      "test": "Test name",
      "reason": "Why this test is recommended",
      "urgency": "Stat" | "Urgent" | "Routine"
    }
  ],
  "treatmentOptions": [
    {
      "treatment": "Treatment name or approach",
      "type": "Pharmacological" | "Non-pharmacological" | "Surgical" | "Referral",
      "details": "Dosage, duration, or further details",
      "considerations": "Contraindications or special considerations"
    }
  ],
  "redFlags": [
    {
      "flag": "Description of the red flag",
      "action": "Recommended immediate action"
    }
  ]
}

Guidelines:
- Provide 3-5 differential diagnoses ranked by probability.
- Only list drug interactions that are clinically relevant to the current medications.
- Suggest 2-4 diagnostic tests.
- Provide 2-4 treatment options.
- Only list red flags if symptoms/vitals indicate potentially dangerous conditions.
- If no drug interactions exist, return an empty array for drugInteractions.
- If no red flags, return an empty array for redFlags.`;

    let responseText = "";
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      try {
        const response = await withProviderDeadline(signal => ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
          abortSignal: signal,
            systemInstruction:
              "You are an expert clinical decision support AI. You assist licensed physicians by providing evidence-based differential diagnoses, drug interaction checks, test recommendations, treatment options, and red flag alerts. You always return valid JSON. This is a decision support tool, not a replacement for clinical judgment.",
            maxOutputTokens: 2000,
          },
        }), req.signal);
        responseText = response.text?.trim() || "";
      } catch (gemErr) {
        if (gemErr instanceof ProviderTimeoutError || req.signal.aborted) throw gemErr;
        console.warn("Clinical AI provider failed; assessment unavailable.");
      }
    }

    const result = parseClinicalAssessment(responseText, diagnosisAssessmentSchema);
    if (!result) return clinicalAssessmentUnavailable();

    return NextResponse.json({
      ...result,
        status: "available",
      disclaimer:
        "This AI-generated clinical decision support is intended to assist licensed physicians only. It does not replace professional clinical judgment. All treatment decisions must be made by a qualified healthcare provider.",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ProviderTimeoutError) return providerTimeoutResponse();
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }

    console.error("POST /api/ai/diagnosis-support error:", error);
    return NextResponse.json(
      { error: "Failed to generate clinical decision support" },
      { status: 500 }
    );
  }
}
