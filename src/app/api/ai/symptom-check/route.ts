import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const symptomCheckSchema = z.object({
  symptoms: z.array(z.string()).min(1, "At least one symptom is required"),
  description: z.string().optional(),
  duration: z.string().min(1, "Duration is required"),
  severity: z.number().min(1).max(10),
  existingConditions: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // ─── Authenticate ────────────────────────────────────
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

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ─── Rate limit (10 calls / 60s per user) ────────────
    const limit = await checkRateLimitAsync(`ai:symptom-check:${user.id}`);
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
    const validated = symptomCheckSchema.parse(body);

    const prompt = `You are a medical triage assistant. Based on the following patient-reported symptoms, provide a preliminary assessment. This is NOT a diagnosis — always recommend professional medical evaluation.

Patient Report:
- Symptoms: ${validated.symptoms.join(", ")}
- Additional description: ${validated.description || "None provided"}
- Duration: ${validated.duration}
- Severity (1-10): ${validated.severity}
- Pre-existing conditions: ${validated.existingConditions?.join(", ") || "None reported"}

Respond ONLY with a valid JSON object in this exact format (no markdown, no code fences):
{
  "urgency": "Low" | "Medium" | "High" | "Emergency",
  "possibleConditions": [
    { "name": "Condition name", "probability": "High/Medium/Low", "description": "Brief explanation" }
  ],
  "recommendation": "Brief recommendation text",
  "seekCareIn": "Timeframe string (e.g., 'Within 24 hours', 'Within 1 week')",
  "selfCareAdvice": ["Advice item 1", "Advice item 2"]
}

Guidelines for urgency levels:
- "Emergency": Severity 9-10, symptoms suggesting stroke, heart attack, severe bleeding, difficulty breathing
- "High": Severity 7-8, symptoms that need prompt medical attention within hours
- "Medium": Severity 4-6, symptoms that should be evaluated within a few days
- "Low": Severity 1-3, mild symptoms manageable with self-care

Provide 2-4 possible conditions, a clear recommendation, and 3-5 self-care tips.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a medical triage assistant that returns structured JSON responses. Never provide definitive diagnoses. Always recommend professional medical consultation.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();

    if (!responseText) {
      return NextResponse.json(
        { error: "No response from AI model" },
        { status: 502 }
      );
    }

    // Parse the JSON response — strip code fences if the model wraps it
    const cleaned = responseText
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    const result = JSON.parse(cleaned);

    return NextResponse.json(
      {
        ...result,
        disclaimer:
          "This assessment is for informational purposes only and does not constitute medical advice. Always consult a qualified healthcare professional for proper diagnosis and treatment.",
      },
      {
        headers: {
          "X-RateLimit-Remaining": String(limit.remaining),
          "X-RateLimit-Reset": String(limit.resetAt),
        },
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }

    console.error("Symptom check error:", error);
    return NextResponse.json(
      { error: "Failed to process symptom check" },
      { status: 500 }
    );
  }
}
