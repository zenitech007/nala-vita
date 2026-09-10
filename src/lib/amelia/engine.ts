// src/lib/amelia/engine.ts
import { getPatientContext } from "./context";
import { getMemoriesForGrounding } from "./memory";
import { patientAdvisorPrompt } from "./prompts";
import { detectFunctionalCues } from "./functional";
import { detectRedFlags, urgencyFromRedFlags, PATIENT_DISCLAIMER, EMERGENCY_MESSAGE } from "./safety";
import { chat, chatStream, type ChatTurn } from "./llm";
import type { AmeliaTurnInput, AmeliaReply } from "./types";

/**
 * Assembles everything the LLM needs for one turn. Shared by the buffered and
 * streaming paths so they can never drift apart.
 */
async function prepareTurn(input: AmeliaTurnInput) {
  const latestUser = [...input.messages].reverse().find((m) => m.role === "user");
  const redFlags = latestUser ? detectRedFlags(latestUser.content) : [];

  // Functional cues are advisory only — unlike red flags they never short-circuit,
  // because "your key sticks" must not produce "call an ambulance".
  const functionalCues = latestUser ? detectFunctionalCues(latestUser.content) : [];

  const [ctx, memories] = await Promise.all([
    getPatientContext(input.patientId),
    getMemoriesForGrounding(input.patientId),
  ]);

  const turns: ChatTurn[] = [
    { role: "system", content: patientAdvisorPrompt(ctx, memories, functionalCues) },
    ...input.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  return { turns, redFlags };
}

export async function runAmeliaTurn(input: AmeliaTurnInput): Promise<AmeliaReply> {
  const latestUser = [...input.messages].reverse().find((m) => m.role === "user");
  const earlyFlags = latestUser ? detectRedFlags(latestUser.content) : [];

  // Emergency short-circuit — deterministic, no LLM call, no data load.
  if (earlyFlags.length > 0) {
    return { content: EMERGENCY_MESSAGE, urgency: "emergency", redFlags: earlyFlags, disclaimer: PATIENT_DISCLAIMER };
  }

  const { turns, redFlags } = await prepareTurn(input);
  const content = await chat(turns);

  return { content, urgency: urgencyFromRedFlags(redFlags), redFlags, disclaimer: PATIENT_DISCLAIMER };
}

export interface AmeliaStreamStart {
  urgency: AmeliaReply["urgency"];
  redFlags: AmeliaReply["redFlags"];
  disclaimer: string;
}

/**
 * Streaming twin of {@link runAmeliaTurn}. Yields the reply in deltas; the caller
 * accumulates them to obtain the full text for persistence.
 *
 * The emergency path yields the canned message as a single delta so callers need
 * only one code path.
 */
export async function* runAmeliaTurnStream(
  input: AmeliaTurnInput
): AsyncGenerator<{ type: "start"; meta: AmeliaStreamStart } | { type: "delta"; text: string }> {
  const latestUser = [...input.messages].reverse().find((m) => m.role === "user");
  const earlyFlags = latestUser ? detectRedFlags(latestUser.content) : [];

  if (earlyFlags.length > 0) {
    yield {
      type: "start",
      meta: { urgency: "emergency", redFlags: earlyFlags, disclaimer: PATIENT_DISCLAIMER },
    };
    yield { type: "delta", text: EMERGENCY_MESSAGE };
    return;
  }

  const { turns, redFlags } = await prepareTurn(input);

  yield {
    type: "start",
    meta: { urgency: urgencyFromRedFlags(redFlags), redFlags, disclaimer: PATIENT_DISCLAIMER },
  };

  for await (const delta of chatStream(turns)) {
    yield { type: "delta", text: delta };
  }
}
