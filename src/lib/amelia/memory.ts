// src/lib/amelia/memory.ts
import { prisma } from "@/lib/prisma";
import { chat } from "./llm";
import type { MemoryKind, MemoryCandidate, AmeliaMemoryFact, GroundingMemories } from "./types";

const HIGH_STAKES: MemoryKind[] = ["ALLERGY", "CONDITION", "MEDICATION"];
const VALID_KINDS: MemoryKind[] = ["ALLERGY", "CONDITION", "MEDICATION", "PREFERENCE", "LIFESTYLE", "OTHER"];

export function isHighStakes(kind: string): boolean {
  return HIGH_STAKES.includes(kind as MemoryKind);
}

export async function extractMemories(userText: string, assistantText: string): Promise<MemoryCandidate[]> {
  const raw = await chat(
    [
      {
        role: "system",
        content:
          'Extract durable, long-term facts about the patient from the exchange. Return ONLY a JSON array (no prose, no code fences) of objects {"kind","value"} where kind is one of ALLERGY, CONDITION, MEDICATION, PREFERENCE, LIFESTYLE, OTHER. Only include stable facts worth remembering across visits (chronic conditions, allergies, long-term medications, durable preferences). Do NOT include transient symptoms, one-off questions, or anything uncertain. If nothing qualifies, return [].',
      },
      { role: "user", content: `Patient said: ${userText}\nAmelia replied: ${assistantText}` },
    ],
    { model: "gpt-4o-mini", temperature: 0, maxTokens: 300 }
  );

  let parsed: unknown;
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(
      (c): c is MemoryCandidate =>
        !!c && typeof c === "object" &&
        typeof (c as { value?: unknown }).value === "string" &&
        VALID_KINDS.includes((c as { kind?: MemoryKind }).kind as MemoryKind)
    )
    .map((c) => ({ kind: c.kind, value: c.value.trim() }))
    .filter((c) => c.value.length > 0);
}
