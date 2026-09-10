// src/__tests__/lib/amelia/engine.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getPatientContext = jest.fn();
const chat = jest.fn();
jest.mock("@/lib/amelia/context", () => ({ getPatientContext: (...a: unknown[]) => getPatientContext(...a) }));
jest.mock("@/lib/amelia/llm", () => ({ chat: (...a: unknown[]) => chat(...a) }));
const getMemoriesForGrounding = jest.fn();
jest.mock("@/lib/amelia/memory", () => ({ getMemoriesForGrounding: (...a: unknown[]) => getMemoriesForGrounding(...a) }));

import { runAmeliaTurn } from "@/lib/amelia/engine";

beforeEach(() => {
  getPatientContext.mockReset();
  chat.mockReset();
  getMemoriesForGrounding.mockReset();
  getMemoriesForGrounding.mockResolvedValue({ known: [], toConfirm: [] });
});

describe("runAmeliaTurn", () => {
  it("short-circuits on an emergency without calling the LLM", async () => {
    const reply = await runAmeliaTurn({
      audience: "patient",
      patientId: "p1",
      messages: [{ role: "user", content: "I have crushing chest pain" }],
    });
    expect(reply.urgency).toBe("emergency");
    expect(reply.content).toMatch(/emergency/i);
    expect(chat).not.toHaveBeenCalled();
    expect(getPatientContext).not.toHaveBeenCalled();
    expect(getMemoriesForGrounding).not.toHaveBeenCalled();
  });

  it("passes functional cues into the system prompt without escalating to emergency", async () => {
    // The sticky-lock case: mechanically framed, must NOT short-circuit, but the
    // prompt must carry the discrepancy so Amelia probes the hands.
    getPatientContext.mockResolvedValue({
      firstName: "Ada", age: 34, gender: "female", allergies: [], activeMedications: [], recentVitals: [], recentLabs: [],
    });
    chat.mockResolvedValue("Let's look at your hands. Worth seeing a clinician.");

    const reply = await runAmeliaTurn({
      audience: "patient",
      patientId: "p1",
      messages: [{ role: "user", content: "my key sticks after work but my wife can open it fine" }],
    });

    expect(reply.urgency).toBe("routine");
    expect(chat).toHaveBeenCalledTimes(1);

    const systemPrompt = (chat.mock.calls[0] as [{ role: string; content: string }[]])[0][0].content;
    expect(systemPrompt).toMatch(/CONTROL_DISCREPANCY/);
    expect(systemPrompt).toMatch(/FATIGUE_PATTERN/);
    expect(systemPrompt).toMatch(/do not dismiss/i);
  });

  it("does not add a functional-cue block to a plain symptom report", async () => {
    getPatientContext.mockResolvedValue({
      firstName: "Ada", age: 34, gender: "female", allergies: [], activeMedications: [], recentVitals: [], recentLabs: [],
    });
    chat.mockResolvedValue("Rest and fluids.");

    await runAmeliaTurn({
      audience: "patient",
      patientId: "p1",
      messages: [{ role: "user", content: "I have a mild headache and a runny nose" }],
    });

    const systemPrompt = (chat.mock.calls[0] as [{ role: string; content: string }[]])[0][0].content;
    expect(systemPrompt).not.toMatch(/SIGNALS DETECTED/);
    // The standing guidance is always present, though.
    expect(systemPrompt).toMatch(/FUNCTIONAL INFERENCE/);
  });

  it("grounds a normal turn in patient context and returns the LLM reply", async () => {
    getPatientContext.mockResolvedValue({
      firstName: "Ada", age: 34, gender: "female", allergies: [], activeMedications: [], recentVitals: [], recentLabs: [],
    });
    chat.mockResolvedValue("Here is some careful advice. Please confirm with a doctor.");

    const reply = await runAmeliaTurn({
      audience: "patient",
      patientId: "p1",
      messages: [{ role: "user", content: "I have a mild sore throat" }],
    });

    expect(getPatientContext).toHaveBeenCalledWith("p1");
    expect(getMemoriesForGrounding).toHaveBeenCalledWith("p1");
    expect(chat).toHaveBeenCalledTimes(1);
    expect(reply.urgency).toBe("routine");
    expect(reply.content).toMatch(/careful advice/);
    expect(reply.disclaimer).toMatch(/not a substitute/i);
  });
});
