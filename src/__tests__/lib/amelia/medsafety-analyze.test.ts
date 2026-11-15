import {mockOf} from "../../helpers/mock";
// src/__tests__/lib/amelia/medsafety-analyze.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
const chat=mockOf<typeof import("@/lib/amelia/llm").chat>();
jest.mock("@/lib/amelia/llm", () => ({ chat: (...a: Parameters<typeof chat>) => chat(...a) }));
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/notifications", () => ({ createNotification: jest.fn() }));

import { analyzeMedications, getCachedOrAnalyze } from "@/lib/amelia/medsafety";

beforeEach(() => {chat.mockReset();});

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

  it("reports analysis unavailable on bad JSON", async () => {
    chat.mockResolvedValue("not json");
    const out = await analyzeMedications([{ medication: "Aspirin", dosage: "81mg" }], []);
    expect(out.interactions).toEqual([]);
    expect(out.status).toBe("unavailable");
    expect(out.overallNote).toMatch(/unavailable/i);
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


it.each([
  {},
  { interactions: [{ drugs: ["aspirin"], severity: "fatal", note: "x" }], dosingNotes: [], allergyConflicts: [], overallNote: "ok" },
  { interactions: [], dosingNotes: [], allergyConflicts: [null], overallNote: "ok" },
])("rejects malformed model output %#", async value => {
  chat.mockResolvedValue(JSON.stringify(value));
  const out = await analyzeMedications([{ medication: "Penicillin", dosage: "500mg" }], ["penicillin"]);
  expect(out.status).toBe("unavailable");
  expect(out.interactions).toEqual([]);
  expect(out.allergyConflicts).toHaveLength(1);
});

it("expires successful cached analysis after five minutes", async () => {
  const now = jest.spyOn(Date, "now").mockReturnValue(1_000);
  chat.mockResolvedValue('{"interactions":[],"dosingNotes":[],"allergyConflicts":[],"overallNote":"ok"}');
  try {
    const meds = [{ medication: "Aspirin", dosage: "81mg" }];
    await getCachedOrAnalyze("ttl-patient", meds, []);
    now.mockReturnValue(301_001);
    await getCachedOrAnalyze("ttl-patient", meds, []);
    expect(chat).toHaveBeenCalledTimes(2);
  } finally {
    now.mockRestore();
  }
});

it("does not retain unavailable analysis", async () => {
  chat.mockResolvedValue("invalid");
  const meds = [{ medication: "Aspirin", dosage: "81mg" }];
  await getCachedOrAnalyze("unavailable-patient", meds, []);
  await getCachedOrAnalyze("unavailable-patient", meds, []);
  expect(chat).toHaveBeenCalledTimes(2);
});

it("bounds cached patient entries", async () => {
  chat.mockResolvedValue('{"interactions":[],"dosingNotes":[],"allergyConflicts":[],"overallNote":"ok"}');
  const meds = [{ medication: "Aspirin", dosage: "81mg" }];
  for (let i = 0; i < 129; i++) await getCachedOrAnalyze("bounded-" + i, meds, []);
  await getCachedOrAnalyze("bounded-0", meds, []);
  expect(chat).toHaveBeenCalledTimes(130);
});
