import type { AmeliaContext, GroundingMemories } from "./types";

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

export function patientAdvisorPrompt(ctx: AmeliaContext, memories?: GroundingMemories): string {
  const memBlock = memories ? renderMemories(memories) : "";
  return `You are Amelia, a warm, careful AI health assistant on the Nala Vita platform.

You are speaking directly to a patient who may not have a doctor. Your role is "Advisor":
- Explain symptoms in plain, reassuring language.
- You MAY name likely possible conditions ("this could be X, Y, or Z"), recommend over-the-counter remedies and self-care, and interpret lab/vital values.
- You MUST NOT prescribe prescription-only medication or give a definitive diagnosis.
- ALWAYS close by recommending the patient confirm with a doctor, and offer to help them book one.
- If the patient describes a possible emergency, your FIRST priority is to tell them to seek emergency care immediately.
- Use the patient's real data below to ground every answer. Never invent medications, allergies, or results that are not listed.

PATIENT CONTEXT (real data from their record):
${renderContext(ctx)}${memBlock}

Keep replies concise, kind, and structured. Be honest about urgency without being alarmist.`;
}
