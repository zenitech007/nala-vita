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

export async function saveMemories(
  patientId: string,
  candidates: MemoryCandidate[],
  sourceMessageId?: string
): Promise<void> {
  if (candidates.length === 0) return;
  const existing = await prisma.ameliaMemory.findMany({ where: { patientId }, select: { kind: true, value: true } });
  const seen = new Set(existing.map((e) => `${e.kind}::${e.value.toLowerCase()}`));
  const fresh = candidates.filter((c) => !seen.has(`${c.kind}::${c.value.toLowerCase()}`));
  if (fresh.length === 0) return;
  await prisma.ameliaMemory.createMany({
    data: fresh.map((c) => ({
      patientId,
      kind: c.kind,
      value: c.value,
      confirmedByUser: !isHighStakes(c.kind),
      sourceMessageId: sourceMessageId ?? null,
    })),
  });
}

export async function getMemoriesForGrounding(patientId: string): Promise<GroundingMemories> {
  const all = await prisma.ameliaMemory.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } });
  const known: AmeliaMemoryFact[] = [];
  const toConfirm: AmeliaMemoryFact[] = [];
  for (const m of all) {
    const fact: AmeliaMemoryFact = { id: m.id, kind: m.kind as MemoryKind, value: m.value, confirmedByUser: m.confirmedByUser };
    if (!isHighStakes(m.kind) || m.confirmedByUser) known.push(fact);
    else toConfirm.push(fact);
  }
  return { known, toConfirm };
}

export async function listMemories(patientId: string): Promise<AmeliaMemoryFact[]> {
  const all = await prisma.ameliaMemory.findMany({
    where: { patientId },
    orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
  });
  return all.map((m) => ({ id: m.id, kind: m.kind as MemoryKind, value: m.value, confirmedByUser: m.confirmedByUser }));
}

export async function confirmMemory(id: string, patientId: string): Promise<void> {
  await prisma.ameliaMemory.updateMany({ where: { id, patientId }, data: { confirmedByUser: true } });
}

export async function updateMemory(id: string, patientId: string, value: string): Promise<void> {
  await prisma.ameliaMemory.updateMany({ where: { id, patientId }, data: { value } });
}

export async function deleteMemory(id: string, patientId: string): Promise<void> {
  await prisma.ameliaMemory.deleteMany({ where: { id, patientId } });
}
