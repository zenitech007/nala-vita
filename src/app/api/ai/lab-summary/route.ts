import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
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
    const supabase = createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { supabaseId: authUser.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

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
      { temperature: 0.3, maxTokens: 400 }
    );

    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    console.error("Lab summary error:", error);
    return NextResponse.json({ error: "Failed to summarize results." }, { status: 500 });
  }
}
