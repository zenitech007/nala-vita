// src/__tests__/lib/amelia/medsafety-analyze.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
const chat = jest.fn();
jest.mock("@/lib/amelia/llm", () => ({ chat: (...a: unknown[]) => chat(...a) }));
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/notifications", () => ({ createNotification: jest.fn() }));

import { analyzeMedications, getCachedOrAnalyze } from "@/lib/amelia/medsafety";

beforeEach(() => chat.mockReset());

describe("analyzeMedications", () => {
  it("parses the LLM result and merges the deterministic allergy net", async () => {
    chat.mockResolvedValue('{"interactions":[{"drugs":["aspirin","warfarin"],"severity":"high","note":"bleeding risk"}],"dosingNotes":[],"allergyConflicts":[],"overallNote":"confirm with a professional"}');
    const out = await analyzeMedications(
      [{ medication: "Penicillin V", dosage: "500mg" }, { medication: "Aspirin", dosage: "81mg" }],
      ["penicillin"]
    );
    expect(out.interactions[0].severity).toBe("high");
    expect(out.allergyConflicts.some((c) => c.allergy === "penicillin")).toBe(true);
  });

  it("falls back to a safe advisory note on bad JSON", async () => {
    chat.mockResolvedValue("not json");
    const out = await analyzeMedications([{ medication: "Aspirin", dosage: "81mg" }], []);
    expect(out.interactions).toEqual([]);
    expect(out.overallNote).toMatch(/confirm/i);
  });

  it("short-circuits with no meds (no LLM call)", async () => {
    const out = await analyzeMedications([], []);
    expect(chat).not.toHaveBeenCalled();
    expect(out.overallNote).toMatch(/no active medications/i);
  });
});

describe("getCachedOrAnalyze", () => {
  it("caches by med list — second call with same meds does not re-run the LLM", async () => {
    chat.mockResolvedValue('{"interactions":[],"dosingNotes":[],"allergyConflicts":[],"overallNote":"ok"}');
    const meds = [{ medication: "Aspirin", dosage: "81mg" }];
    await getCachedOrAnalyze("patC", meds, []);
    await getCachedOrAnalyze("patC", meds, []);
    expect(chat).toHaveBeenCalledTimes(1);
  });
});
