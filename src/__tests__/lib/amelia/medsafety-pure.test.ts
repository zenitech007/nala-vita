// src/__tests__/lib/amelia/medsafety-pure.test.ts
import { describe, it, expect, jest } from "@jest/globals";
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/amelia/llm", () => ({ chat: jest.fn() }));
jest.mock("@/lib/notifications", () => ({ createNotification: jest.fn() }));

import { medListHash, exactAllergyMatches } from "@/lib/amelia/medsafety";

describe("medListHash", () => {
  it("is order-independent and case-insensitive", () => {
    const a = medListHash([{ medication: "Lisinopril", dosage: "10mg" }, { medication: "Aspirin", dosage: "81mg" }]);
    const b = medListHash([{ medication: "aspirin", dosage: "81MG" }, { medication: "lisinopril", dosage: "10MG" }]);
    expect(a).toBe(b);
  });
  it("changes when a med changes", () => {
    const a = medListHash([{ medication: "Aspirin", dosage: "81mg" }]);
    const b = medListHash([{ medication: "Aspirin", dosage: "325mg" }]);
    expect(a).not.toBe(b);
  });
});

describe("exactAllergyMatches", () => {
  it("flags a med whose name contains a listed allergy", () => {
    const out = exactAllergyMatches([{ medication: "Penicillin V", dosage: "500mg" }], ["penicillin"]);
    expect(out).toHaveLength(1);
    expect(out[0].medication).toBe("Penicillin V");
    expect(out[0].allergy).toBe("penicillin");
  });
  it("returns nothing when there is no match", () => {
    expect(exactAllergyMatches([{ medication: "Aspirin", dosage: "81mg" }], ["penicillin"])).toHaveLength(0);
  });
});
