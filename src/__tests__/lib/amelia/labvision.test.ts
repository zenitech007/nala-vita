// src/__tests__/lib/amelia/labvision.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
const visionChat = jest.fn();
jest.mock("@/lib/amelia/llm", () => ({ visionChat: (...a: unknown[]) => visionChat(...a) }));

import { extractLabsFromImage } from "@/lib/amelia/labvision";

beforeEach(() => visionChat.mockReset());

describe("extractLabsFromImage", () => {
  it("parses extracted labs + summary and normalizes flags", async () => {
    visionChat.mockResolvedValue('{"results":[{"name":"Glucose","value":"110","unit":"mg/dL","referenceRange":"70-99","flag":"abnormal"},{"name":"HbA1c","value":"5.4","unit":"%","referenceRange":null,"flag":"weird"}],"summary":"Your glucose is slightly high.","overallNote":"Confirm with your doctor."}');
    const out = await extractLabsFromImage("data:image/jpeg;base64,AAA");
    expect(out.results).toHaveLength(2);
    expect(out.results[0]).toEqual({ name: "Glucose", value: "110", unit: "mg/dL", referenceRange: "70-99", flag: "abnormal" });
    expect(out.results[1].flag).toBe("unknown");
    expect(out.summary).toMatch(/glucose/i);
  });

  it("falls back to an advisory message on non-JSON output", async () => {
    visionChat.mockResolvedValue("I can't read this clearly.");
    const out = await extractLabsFromImage("data:image/jpeg;base64,AAA");
    expect(out.results).toEqual([]);
    expect(out.summary).toMatch(/couldn'?t read/i);
    expect(out.overallNote).toMatch(/doctor/i);
  });

  it("drops malformed result entries", async () => {
    visionChat.mockResolvedValue('{"results":[{"value":"x"},{"name":"WBC","value":"6.0","unit":null,"referenceRange":null,"flag":"normal"}],"summary":"ok","overallNote":"confirm"}');
    const out = await extractLabsFromImage("data:image/jpeg;base64,AAA");
    expect(out.results).toHaveLength(1);
    expect(out.results[0].name).toBe("WBC");
  });
});
