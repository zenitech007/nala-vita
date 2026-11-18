import { ProviderTimeoutError, providerTimeoutResponse } from "@/lib/provider-deadline";
import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";


import { checkRateLimitAsync } from "@/lib/rate-limit";
import { chat } from "@/lib/amelia/llm";

const resultSchema = z.object({
  resultValue: z.string(),
  unit: z.string().nullable().optional(),
  referenceMin: z.string().nullable().optional(),
  referenceMax: z.string().nullable().optional(),
  isAbnormal: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});
const bodySchema = z.object({ testName: z.string().min(1), results: z.array(resultSchema).min(1) });

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR"] });
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const limit = await checkRateLimitAsync(`amelia:lab-summary:${user.id}`);
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

    const { testName, results } = bodySchema.parse(await req.json());
    const rows = results
      .map((r) => `- ${r.resultValue}${r.unit ? " " + r.unit : ""}${r.referenceMin || r.referenceMax ? ` (ref ${r.referenceMin ?? "?"}-${r.referenceMax ?? "?"})` : ""}${r.isAbnormal ? " [flagged abnormal]" : ""}`)
      .join("\n");

    const summary = await chat(
      [
        { role: "system", content: "You are Amelia, a health assistant. Explain lab results to a patient in plain, calm language. Do not diagnose. Always end by suggesting they confirm with a doctor." },
        { role: "user", content: `Explain my "${testName}" results:\n${rows}` },
      ],
      { temperature: 0.3, maxTokens: 400, signal: req.signal }
    );

    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof ProviderTimeoutError) return providerTimeoutResponse();
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    console.error("Lab summary error:", error);
    return NextResponse.json({ error: "Failed to summarize results." }, { status: 500 });
  }
}
