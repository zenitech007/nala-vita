// src/lib/amelia/safety.ts
import type { RedFlag, Urgency } from "./types";

const RED_FLAG_RULES: { test: RegExp; reason: string }[] = [
  { test: /\b(chest pain|pressure in (my )?chest|crushing chest)\b/i, reason: "Possible cardiac emergency" },
  { test: /\b(can'?t breathe|trouble breathing|short(ness)? of breath|gasping)\b/i, reason: "Possible respiratory distress" },
  { test: /\b(face droop|slurred speech|sudden numbness|can'?t move (my )?(arm|leg))\b/i, reason: "Possible stroke (FAST signs)" },
  { test: /\b(suicidal|kill myself|end my life|want to die)\b/i, reason: "Mental-health crisis" },
  { test: /\b(severe bleeding|won'?t stop bleeding|coughing up blood|vomiting blood)\b/i, reason: "Severe hemorrhage" },
  { test: /\b(unconscious|passed out|unresponsive|seizure)\b/i, reason: "Loss of consciousness / seizure" },
  { test: /\b(throat closing|anaphylaxis|swelling of (my )?(face|tongue|throat))\b/i, reason: "Possible anaphylaxis" },
];

export function detectRedFlags(text: string): RedFlag[] {
  return RED_FLAG_RULES.filter((r) => r.test.test(text)).map((r) => ({
    pattern: r.test.source,
    reason: r.reason,
  }));
}

export function urgencyFromRedFlags(flags: RedFlag[]): Urgency {
  return flags.length > 0 ? "emergency" : "routine";
}

export const PATIENT_DISCLAIMER =
  "Amelia is an AI health assistant, not a substitute for a doctor. For anything serious or worsening, please consult a healthcare professional.";

export const EMERGENCY_MESSAGE =
  "⚠️ Your symptoms may indicate a medical emergency. Please call emergency services (911 or your local equivalent) or go to the nearest emergency room immediately.";

export const PRIVACY_NOTICE =
  "Your conversations with Amelia are private and protected under applicable health privacy regulations (e.g., HIPAA). I only access the medical record of the signed-in patient.";
