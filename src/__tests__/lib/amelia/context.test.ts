// src/__tests__/lib/amelia/context.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const findUnique = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { patient: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

import { getPatientContext } from "@/lib/amelia/context";

beforeEach(() => findUnique.mockReset());

describe("getPatientContext", () => {
  it("maps the patient record into a grounded context", async () => {
    findUnique.mockResolvedValue({
      user: { firstName: "Ada" },
      dateOfBirth: new Date("1992-01-01"),
      gender: "female",
      allergies: ["penicillin"],
      prescriptions: [{ medication: "lisinopril", dosage: "10mg", frequency: "daily" }],
      vitals: [{ recordedAt: new Date("2026-06-01"), bloodPressure: "150/95", heartRate: 88, bloodSugar: null, oxygenSaturation: 98 }],
      labOrders: [{ testName: "HbA1c", results: [{ resultValue: "6.1", unit: "%", isAbnormal: false }] }],
    });

    const ctx = await getPatientContext("pat_1");
    expect(ctx.firstName).toBe("Ada");
    expect(ctx.allergies).toContain("penicillin");
    expect(ctx.activeMedications[0].medication).toBe("lisinopril");
    expect(ctx.recentLabs[0].testName).toBe("HbA1c");
    expect(ctx.age).toBeGreaterThan(30);
  });

  it("throws when the patient is missing", async () => {
    findUnique.mockResolvedValue(null);
    await expect(getPatientContext("nope")).rejects.toThrow(/not found/i);
  });
});
