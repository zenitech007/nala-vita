// src/lib/amelia/medsafety.ts
import { prisma } from "@/lib/prisma";
import { chat } from "./llm";
import { createNotification } from "@/lib/notifications";

export type Severity = "high" | "moderate" | "low";

export interface MedSafetyResult {
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
