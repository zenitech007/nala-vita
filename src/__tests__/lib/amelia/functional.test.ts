// src/__tests__/lib/amelia/functional.test.ts
import { describe, it, expect } from "@jest/globals";
import {
  detectFunctionalCues,
  renderFunctionalCues,
  type FunctionalCueKind,
} from "@/lib/amelia/functional";

const kinds = (text: string): FunctionalCueKind[] =>
  detectFunctionalCues(text).map((c) => c.kind);

describe("detectFunctionalCues", () => {
  it("catches asymmetry framed as a cosmetic complaint (lipstick case)", () => {
    // Regression: previously answered purely as a beauty/application question.
    const k = kinds("my lipstick always wears off unevenly on one side, why?");
    expect(k).toContain("ASYMMETRY");
  });

  it("catches a control discrepancy — same object, different person (sticky lock case)", () => {
    // Regression: previously dismissed as "not health-related" hardware advice.
    const k = kinds(
      "my front door key has gotten sticky, but my husband can open it fine every time"
    );
    expect(k).toContain("CONTROL_DISCREPANCY");
  });

  it("catches fatigue / time-of-day degradation", () => {
    expect(kinds("the key only gives me trouble after work")).toContain("FATIGUE_PATTERN");
    expect(kinds("it's much worse by the end of the day")).toContain("FATIGUE_PATTERN");
    expect(kinds("my hands are clumsy when I'm tired")).toContain("FATIGUE_PATTERN");
  });

  it("catches fine-motor tasks described mechanically", () => {
    expect(kinds("I keep dropping things lately")).toContain("FINE_MOTOR");
    expect(kinds("buttons on my shirt have gotten hard to do")).toContain("FINE_MOTOR");
    expect(kinds("I can't get the jar lid off anymore")).toContain("FINE_MOTOR");
  });

  it("catches biometric/device failure as a possible body change (fingerprint case)", () => {
    const k = kinds("my phone's fingerprint sensor stopped recognising my thumb in the morning");
    expect(k).toContain("DEVICE_BIOMETRIC");
    expect(k).toContain("FATIGUE_PATTERN");
  });

  it("catches the user pre-emptively disclaiming medical relevance", () => {
    expect(kinds("random question, probably not health related, but my grip feels off")).toContain(
      "NON_MEDICAL_FRAMING"
    );
  });

  it("stacks multiple cues for the full sticky-lock presentation", () => {
    const k = kinds(
      "My key sticks in the lock after work but my wife can open it fine — probably not a health thing"
    );
    expect(k).toContain("CONTROL_DISCREPANCY");
    expect(k).toContain("FATIGUE_PATTERN");
    expect(k).toContain("NON_MEDICAL_FRAMING");
  });

  it("stays quiet on a plain symptom report — the normal path must not change", () => {
    expect(detectFunctionalCues("I have a mild headache and a runny nose")).toHaveLength(0);
    expect(detectFunctionalCues("I've had a sore throat for two days")).toHaveLength(0);
  });

  it("does not fire on incidental mentions of other people or times", () => {
    expect(detectFunctionalCues("my husband booked the appointment for me")).toHaveLength(0);
    expect(detectFunctionalCues("can I take this in the morning with food?")).toHaveLength(0);
  });

  it("returns a probe question with every cue", () => {
    for (const cue of detectFunctionalCues("my lipstick wears unevenly on one side")) {
      expect(cue.probe.length).toBeGreaterThan(0);
      expect(cue.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("renderFunctionalCues", () => {
  it("renders an empty string when there are no cues", () => {
    expect(renderFunctionalCues([])).toBe("");
  });

  it("renders the probes and forbids dismissing the topic as non-medical", () => {
    const out = renderFunctionalCues(
      detectFunctionalCues("my key sticks after work but my wife can open it fine")
    );
    expect(out).toMatch(/FUNCTIONAL/i);
    expect(out).toMatch(/do not dismiss/i);
    // The probe text itself must reach the model, not just the cue label.
    expect(out).toMatch(/grip strength/i);
    expect(out).toMatch(/CONTROL_DISCREPANCY/);
    // And it must stay non-alarmist.
    expect(out).toMatch(/non-alarmist/i);
  });
});
