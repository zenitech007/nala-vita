// src/__tests__/lib/amelia/safety.test.ts
import { describe, it, expect } from "@jest/globals";
import { detectRedFlags, urgencyFromRedFlags, PATIENT_DISCLAIMER, EMERGENCY_MESSAGE } from "@/lib/amelia/safety";

describe("amelia safety", () => {
  it("flags an emergency phrase", () => {
    const flags = detectRedFlags("I have crushing chest pain and can't breathe");
    expect(flags.length).toBeGreaterThan(0);
    expect(urgencyFromRedFlags(flags)).toBe("emergency");
  });

  it("does not flag a mild symptom", () => {
    const flags = detectRedFlags("I have a mild headache and a runny nose");
    expect(flags).toHaveLength(0);
    expect(urgencyFromRedFlags(flags)).toBe("routine");
  });

  it("exposes the disclaimer and emergency strings", () => {
    expect(PATIENT_DISCLAIMER).toMatch(/not a substitute/i);
    expect(EMERGENCY_MESSAGE).toMatch(/emergency/i);
  });
});
