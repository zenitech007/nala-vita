// src/lib/amelia/engine.ts
import { getPatientContext } from "./context";
import { getMemoriesForGrounding } from "./memory";
import { patientAdvisorPrompt } from "./prompts";
import { detectRedFlags, urgencyFromRedFlags, PATIENT_DISCLAIMER, EMERGENCY_MESSAGE } from "./safety";
import { chat, type ChatTurn } from "./llm";
import type { AmeliaTurnInput, AmeliaReply } from "./types";

export async function runAmeliaTurn(input: AmeliaTurnInput): Promise<AmeliaReply> {
  const latestUser = [...input.messages].reverse().find((m) => m.role === "user");
  const redFlags = latestUser ? detectRedFlags(latestUser.content) : [];

  // Emergency short-circuit — deterministic, no LLM call, no data load.
  if (redFlags.length > 0) {
    return { content: EMERGENCY_MESSAGE, urgency: "emergency", redFlags, disclaimer: PATIENT_DISCLAIMER };
  }

  const [ctx, memories] = await Promise.all([
    getPatientContext(input.patientId),
    getMemoriesForGrounding(input.patientId),
  ]);

  const turns: ChatTurn[] = [
    { role: "system", content: patientAdvisorPrompt(ctx, memories) },
    ...input.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const content = await chat(turns);

  return { content, urgency: urgencyFromRedFlags(redFlags), redFlags, disclaimer: PATIENT_DISCLAIMER };
}
