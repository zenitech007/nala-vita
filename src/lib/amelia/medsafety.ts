import { createHash } from "node:crypto";
import { z } from "zod";
import { loadVisiblePatientRecord } from "@/lib/visible-patient-record";
import type { RecordViewer } from "@/lib/record-visibility";
// src/lib/amelia/medsafety.ts
import { prisma } from "@/lib/prisma";
import { chat } from "./llm";
import { createNotification } from "@/lib/notifications";

export type Severity = "high" | "moderate" | "low";

export interface MedSafetyResult {
  status: "available" | "unavailable";
  interactions: { drugs: string[]; severity: Severity; note: string }[];
  dosingNotes: { medication: string; note: string }[];
  allergyConflicts: { medication: string; allergy: string; note: string }[];
  overallNote: string;
}

export interface MedInput {
  medication: string;
  dosage: string;
}

export function medListHash(meds: MedInput[]): string {
  return meds
    .map((m) => `${m.medication.toLowerCase().trim()}|${m.dosage.toLowerCase().trim()}`)
    .sort()
    .join("~");
}

export function exactAllergyMatches(
  meds: MedInput[],
  allergies: string[]
): { medication: string; allergy: string; note: string }[] {
  const out: { medication: string; allergy: string; note: string }[] = [];
  for (const m of meds) {
    const medLower = m.medication.toLowerCase();
    for (const a of allergies) {
      const aLower = a.toLowerCase().trim();
      if (aLower && medLower.includes(aLower)) {
        out.push({ medication: m.medication, allergy: a, note: `${m.medication} matches a listed allergy (${a}).` });
      }
    }
  }
  return out;
}

function mergeConflicts(
  llm: { medication: string; allergy: string; note: string }[],
  det: { medication: string; allergy: string; note: string }[]
): { medication: string; allergy: string; note: string }[] {
  const seen = new Set(llm.map((c) => `${c.medication.toLowerCase()}|${c.allergy.toLowerCase()}`));
  return [...llm, ...det.filter((c) => !seen.has(`${c.medication.toLowerCase()}|${c.allergy.toLowerCase()}`))];
}

const shortText = z.string().trim().min(1).max(1000);
const analysisSchema = z.object({
  interactions: z.array(z.object({
    drugs: z.array(shortText).min(2).max(20),
    severity: z.enum(["high", "moderate", "low"]),
    note: shortText,
  })).max(100),
  dosingNotes: z.array(z.object({ medication: shortText, note: shortText })).max(100),
  allergyConflicts: z.array(z.object({ medication: shortText, allergy: shortText, note: shortText })).max(100),
  overallNote: shortText,
});

function unavailableAnalysis(allergyConflicts: MedSafetyResult["allergyConflicts"]): MedSafetyResult {
  return {
    status: "unavailable",
    interactions: [],
    dosingNotes: [],
    allergyConflicts,
    overallNote: "Analysis unavailable. Ask your pharmacist or doctor to review your medications. Listed allergy matches may still require attention.",
  };
}

export async function analyzeMedications(meds: MedInput[], allergies: string[]): Promise<MedSafetyResult> {
  const deterministic = exactAllergyMatches(meds, allergies);
  if (meds.length === 0) {
    return { status: "available", interactions: [], dosingNotes: [], allergyConflicts: deterministic, overallNote: "No active medications on record." };
  }

  const medLines = meds.map((m) => `- ${m.medication} ${m.dosage}`).join("\n");
  const allergyLine = allergies.length ? allergies.join(", ") : "none on record";
  let raw: string;
  try {
    raw = await chat(
    [
      {
        role: "system",
        content:
          'You are a medication-safety assistant. Review the patient\'s medications and allergies. Return ONLY JSON (no prose, no code fences): {"interactions":[{"drugs":[".."],"severity":"high|moderate|low","note":".."}],"dosingNotes":[{"medication":"..","note":".."}],"allergyConflicts":[{"medication":"..","allergy":"..","note":".."}],"overallNote":".."}. Flag only POTENTIAL concerns; keep notes short. Recognise drug-class allergy conflicts (e.g. amoxicillin with a penicillin allergy). Never invent medications not in the list. Keep overallNote advisory. If nothing notable, return empty arrays with the advisory note.',
      },
      { role: "user", content: `Medications:\n${medLines}\nAllergies: ${allergyLine}` },
    ],
    { temperature: 0.2, maxTokens: 700 }
  );

  } catch {
    return unavailableAnalysis(deterministic);
  }

  if (raw.length > 32_000) return unavailableAnalysis(deterministic);
  let parsed: z.infer<typeof analysisSchema>;
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    parsed = analysisSchema.parse(JSON.parse(cleaned));
  } catch {
    return unavailableAnalysis(deterministic);
  }

  return {
    status: "available",
    ...parsed,
    allergyConflicts: mergeConflicts(parsed.allergyConflicts, deterministic),
  };
}

const CACHE_VERSION = "med-safety-v2";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 128;
const cache = new Map<string, { expiresAt: number; result: MedSafetyResult }>();

export async function getCachedOrAnalyze(patientId: string, meds: MedInput[], allergies: string[]): Promise<MedSafetyResult> {
  const key = createHash("sha256").update(JSON.stringify([
    CACHE_VERSION, patientId, medListHash(meds),
    allergies.map(a => a.toLowerCase().trim()).sort(),
  ])).digest("hex");
  const now = Date.now();
  for (const [cachedKey, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(cachedKey);
  }
  const cached = cache.get(key);
  if (cached) return cached.result;
  const result = await analyzeMedications(meds, allergies);
  if (result.status === "available") {
    if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  }
  return result;
}

export async function checkNewPrescriptionSafety(patientId: string, newMedName: string, viewer: RecordViewer): Promise<void> {
  const record = await loadVisiblePatientRecord(viewer, patientId);
  const patient = { ...record.patient, prescriptions: record.prescriptions.filter(p => p.isActive) };
  const meds: MedInput[] = patient.prescriptions.map((p) => ({ medication: p.medication, dosage: p.dosage }));
  const result = await analyzeMedications(meds, patient.allergies);

  const newLower = newMedName.toLowerCase();
  const involvesNew = (name: string) => {
    const n = name.toLowerCase();
    return n.includes(newLower) || newLower.includes(n);
  };
  const relevant =
    result.interactions.some(
      (i) => (i.severity === "high" || i.severity === "moderate") && i.drugs.some((d) => involvesNew(d))
    ) || result.allergyConflicts.some((c) => involvesNew(c.medication));

  if (relevant) {
    await createNotification(
      (await prisma.patient.findUniqueOrThrow({ where: { id: patientId }, select: { userId: true } })).userId,
      "Medication safety",
      "Amelia flagged a possible interaction with your new medication — review it.",
      "MED_SAFETY",
      { link: "/patient/medications" }
    );
  }
}
