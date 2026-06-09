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

function mergeConflicts(
  llm: { medication: string; allergy: string; note: string }[],
  det: { medication: string; allergy: string; note: string }[]
): { medication: string; allergy: string; note: string }[] {
  const seen = new Set(llm.map((c) => `${c.medication.toLowerCase()}|${c.allergy.toLowerCase()}`));
  return [...llm, ...det.filter((c) => !seen.has(`${c.medication.toLowerCase()}|${c.allergy.toLowerCase()}`))];
}

const ADVISORY = "These are potential concerns — confirm with your pharmacist or doctor.";

export async function analyzeMedications(meds: MedInput[], allergies: string[]): Promise<MedSafetyResult> {
  const deterministic = exactAllergyMatches(meds, allergies);
  if (meds.length === 0) {
    return { interactions: [], dosingNotes: [], allergyConflicts: deterministic, overallNote: "No active medications on record." };
  }

  const medLines = meds.map((m) => `- ${m.medication} ${m.dosage}`).join("\n");
  const allergyLine = allergies.length ? allergies.join(", ") : "none on record";
  const raw = await chat(
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

  let parsed: Partial<MedSafetyResult> = {};
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {};
  }

  return {
    interactions: Array.isArray(parsed.interactions) ? parsed.interactions : [],
    dosingNotes: Array.isArray(parsed.dosingNotes) ? parsed.dosingNotes : [],
    allergyConflicts: mergeConflicts(Array.isArray(parsed.allergyConflicts) ? parsed.allergyConflicts : [], deterministic),
    overallNote: typeof parsed.overallNote === "string" && parsed.overallNote.trim() ? parsed.overallNote : ADVISORY,
  };
}

const cache = new Map<string, { hash: string; result: MedSafetyResult }>();

export async function getCachedOrAnalyze(patientId: string, meds: MedInput[], allergies: string[]): Promise<MedSafetyResult> {
  const hash = medListHash(meds) + "::" + [...allergies].map((a) => a.toLowerCase().trim()).sort().join(",");
  const cached = cache.get(patientId);
  if (cached && cached.hash === hash) return cached.result;
  const result = await analyzeMedications(meds, allergies);
  cache.set(patientId, { hash, result });
  return result;
}

export async function checkNewPrescriptionSafety(patientId: string, newMedName: string): Promise<void> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { prescriptions: { where: { isActive: true } } },
  });
  if (!patient) return;

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
      patient.userId,
      "Medication safety",
      "Amelia flagged a possible interaction with your new medication — review it.",
      "MED_SAFETY",
      { link: "/patient/medications" }
    );
  }
}
