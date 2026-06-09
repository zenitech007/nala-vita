// src/__tests__/lib/amelia/memory-extract.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const chat = jest.fn();
jest.mock("@/lib/amelia/llm", () => ({ chat: (...a: unknown[]) => chat(...a) }));

import { isHighStakes, extractMemories } from "@/lib/amelia/memory";

beforeEach(() => chat.mockReset());

describe("isHighStakes", () => {
  it("flags medical kinds as high-stakes", () => {
    expect(isHighStakes("ALLERGY")).toBe(true);
    expect(isHighStakes("CONDITION")).toBe(true);
    expect(isHighStakes("MEDICATION")).toBe(true);
  });
  it("treats preferences/lifestyle as low-stakes", () => {
    expect(isHighStakes("PREFERENCE")).toBe(false);
    expect(isHighStakes("LIFESTYLE")).toBe(false);
    expect(isHighStakes("OTHER")).toBe(false);
  });
});

describe("extractMemories", () => {
  it("parses a JSON array of valid candidates", async () => {
    chat.mockResolvedValue('[{"kind":"ALLERGY","value":"penicillin"},{"kind":"PREFERENCE","value":"prefers morning appointments"}]');
    const out = await extractMemories("I am allergic to penicillin", "Noted.");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ kind: "ALLERGY", value: "penicillin" });
  });

  it("strips code fences and drops invalid entries", async () => {
    chat.mockResolvedValue('```json\n[{"kind":"NOPE","value":"x"},{"kind":"CONDITION","value":"type 2 diabetes"}]\n```');
    const out = await extractMemories("...", "...");
    expect(out).toEqual([{ kind: "CONDITION", value: "type 2 diabetes" }]);
  });

  it("returns [] when the model returns non-JSON", async () => {
    chat.mockResolvedValue("I could not find anything.");
    expect(await extractMemories("hi", "hello")).toEqual([]);
  });
});
