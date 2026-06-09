import { describe, it, expect } from "@jest/globals";
import { renderContext, patientAdvisorPrompt } from "@/lib/amelia/prompts";
import type { AmeliaContext } from "@/lib/amelia/types";

const ctx: AmeliaContext = {
  firstName: "Ada",
  age: 34,
  gender: "female",
  allergies: ["penicillin"],
  activeMedications: [{ medication: "lisinopril", dosage: "10mg", frequency: "daily" }],
  recentVitals: [{ recordedAt: "2026-06-01", bloodPressure: "150/95", heartRate: 88, bloodSugar: null, oxygenSaturation: 98 }],
  recentLabs: [{ testName: "HbA1c", resultValue: "6.1", unit: "%", isAbnormal: false }],
};

describe("amelia prompts", () => {
  it("renders the patient's real data", () => {
    const out = renderContext(ctx);
    expect(out).toMatch(/penicillin/);
    expect(out).toMatch(/lisinopril/);
    expect(out).toMatch(/150\/95/);
  });

  it("builds an Advisor system prompt naming Amelia + the patient", () => {
    const p = patientAdvisorPrompt(ctx);
    expect(p).toMatch(/Amelia/);
    expect(p).toMatch(/Ada/);
    expect(p).toMatch(/confirm with a doctor/i);
    expect(p).toMatch(/emergency/i);
  });
});
