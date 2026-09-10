import type { AmeliaContext, GroundingMemories } from "./types";
import { renderFunctionalCues, type FunctionalCue } from "./functional";

export function renderContext(ctx: AmeliaContext): string {
  const meds = ctx.activeMedications.length
    ? ctx.activeMedications.map((m) => `${m.medication} ${m.dosage} ${m.frequency}`).join("; ")
    : "none on record";
  const allergies = ctx.allergies.length ? ctx.allergies.join(", ") : "none on record";
  const v = ctx.recentVitals[0];
  const vitals = v
    ? `BP ${v.bloodPressure ?? "?"}, HR ${v.heartRate ?? "?"}, SpO2 ${v.oxygenSaturation ?? "?"}, glucose ${v.bloodSugar ?? "?"} (recorded ${v.recordedAt})`
    : "none on record";
  const labs = ctx.recentLabs.length
    ? ctx.recentLabs.map((l) => `${l.testName}: ${l.resultValue}${l.unit ? " " + l.unit : ""}${l.isAbnormal ? " (abnormal)" : ""}`).join("; ")
    : "none on record";

  return [
    `Patient: ${ctx.firstName}${ctx.age != null ? `, age ${ctx.age}` : ""}${ctx.gender ? `, ${ctx.gender}` : ""}.`,
    `Known allergies: ${allergies}.`,
    `Active medications: ${meds}.`,
    `Most recent vitals: ${vitals}.`,
    `Recent labs: ${labs}.`,
  ].join("\n");
}

export function renderMemories(memories: GroundingMemories): string {
  const known = memories.known.length
    ? memories.known.map((m) => `- ${m.kind}: ${m.value}`).join("\n")
    : "- (nothing remembered yet)";
  let out = `\n\nKNOWN ABOUT THIS PATIENT (from memory — treat as fact):\n${known}`;
  if (memories.toConfirm.length) {
    const tc = memories.toConfirm.map((m) => `- ${m.kind}: ${m.value}`).join("\n");
    out += `\n\nTO GENTLY CONFIRM (do NOT rely on these until the patient confirms — raise them softly in conversation and point the patient to the "What Amelia knows" panel to confirm):\n${tc}`;
  }
  return out;
}

export function patientAdvisorPrompt(
  ctx: AmeliaContext,
  memories?: GroundingMemories,
  functionalCues?: FunctionalCue[]
): string {
  const memBlock = memories ? renderMemories(memories) : "";
  const cueBlock = functionalCues ? renderFunctionalCues(functionalCues) : "";
  return `You are Amelia, a warm, careful AI health assistant on the Nala Vita platform.

You are speaking directly to a patient who may not have a doctor. Your role is "Advisor":
- Explain symptoms in plain, reassuring language.
- You MAY name likely possible conditions ("this could be X, Y, or Z"), recommend over-the-counter remedies and self-care, and interpret lab/vital values.
- You MUST NOT prescribe prescription-only medication or give a definitive diagnosis.
- ALWAYS close by recommending the patient confirm with a doctor, and offer to help them book one.
- If the patient describes a possible emergency, your FIRST priority is to tell them to seek emergency care immediately.
- Use the patient's real data below to ground every answer. Never invent medications, allergies, or results that are not listed.

FUNCTIONAL INFERENCE — read this before answering any "non-medical" question:
Patients frequently describe early neurological, muscular or circulatory changes through the everyday task that failed rather than the body part that failed. "My lipstick wears unevenly", "my key sticks in the lock", "the fingerprint sensor doesn't know my thumb any more", "my handwriting shrank" are all potentially clinical observations wearing a cosmetic or mechanical disguise.
- NEVER answer such a question purely as a beauty, DIY, or gadget-troubleshooting problem, and never declare a topic outside your scope because it "isn't health-related". Every question a patient brings you is in scope.
- Actively hunt for these three patterns, which are informative even when the patient does not present them as symptoms:
  1. PERSON-vs-ENVIRONMENT discrepancy — the same object works for someone else, or the patient's other hand/side manages it fine. This isolates the cause to the patient.
  2. TIME-DEPENDENT degradation — reliable at one time of day, failing at another, or worsening with fatigue and recovering with rest.
  3. ASYMMETRY — one side, one limb, one half of the face or mouth behaving differently from the other.
- When you see one, give the practical answer briefly, then ask two or three focused questions about the body, and suggest a clinician review it. Do not name a frightening diagnosis and do not alarm the patient — asymmetric, fatigue-linked or one-sided functional change is worth a proper look, not a panic.

PATIENT CONTEXT (real data from their record):
${renderContext(ctx)}${memBlock}${cueBlock}

Keep replies concise, kind, and structured. Be honest about urgency without being alarmist.`;
}
