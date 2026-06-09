// src/__tests__/lib/amelia/prompts-memory.test.ts
import { describe, it, expect } from "@jest/globals";
import { patientAdvisorPrompt } from "@/lib/amelia/prompts";
import type { AmeliaContext, GroundingMemories } from "@/lib/amelia/types";

const ctx: AmeliaContext = {
  firstName: "Ada", age: 34, gender: "female", allergies: [], activeMedications: [], recentVitals: [], recentLabs: [],
};

describe("patientAdvisorPrompt with memory", () => {
  it("includes known facts and a to-confirm block", () => {
    const mem: GroundingMemories = {
      known: [{ id: "1", kind: "PREFERENCE", value: "prefers mornings", confirmedByUser: false }],
      toConfirm: [{ id: "2", kind: "ALLERGY", value: "penicillin", confirmedByUser: false }],
    };
    const p = patientAdvisorPrompt(ctx, mem);
    expect(p).toMatch(/KNOWN ABOUT THIS PATIENT/);
    expect(p).toMatch(/prefers mornings/);
    expect(p).toMatch(/TO GENTLY CONFIRM/);
    expect(p).toMatch(/penicillin/);
    expect(p).toMatch(/do NOT rely on/i);
  });

  it("omits the to-confirm block when there is nothing to confirm", () => {
    const mem: GroundingMemories = { known: [], toConfirm: [] };
    const p = patientAdvisorPrompt(ctx, mem);
    expect(p).not.toMatch(/TO GENTLY CONFIRM/);
  });

  it("still works with no memory argument (Phase 1 behavior)", () => {
    expect(patientAdvisorPrompt(ctx)).toMatch(/Amelia/);
  });
});
