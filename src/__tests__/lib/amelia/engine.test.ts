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
