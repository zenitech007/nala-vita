// src/__tests__/lib/amelia/context.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const findUnique = jest.fn<any>();
jest.mock("@/lib/prisma", () => ({ prisma: {
 patient: { findUnique: (...a: unknown[]) => findUnique(...a), findFirst: (...a: unknown[]) => findUnique(...a) },
 vital: { findMany: async () => (await findUnique())?.vitals ?? [] },
 prescription: { findMany: async () => (await findUnique())?.prescriptions ?? [] },
 labOrder: { findMany: async () => (await findUnique())?.labOrders ?? [] },
 medicalNote: { findMany: async () => [] }, referral: { findMany: async () => [] }, appointment: { findMany: async () => [] },
} }));

import { getPatientContext } from "@/lib/amelia/context";

beforeEach(() => findUnique.mockReset());

describe("getPatientContext", () => {
  it("maps the patient record into a grounded context", async () => {
    findUnique.mockResolvedValue({
      userId: "u", user: { firstName: "Ada" },
      dateOfBirth: new Date("1992-01-01"),
      gender: "female",
      allergies: ["penicillin"],
      prescriptions: [{ isActive: true, medication: "lisinopril", dosage: "10mg", frequency: "daily" }],
      vitals: [{ recordedAt: new Date("2026-06-01"), bloodPressure: "150/95", heartRate: 88, bloodSugar: null, oxygenSaturation: 98 }],
      labOrders: [{ testName: "HbA1c", results: [{ resultValue: "6.1", unit: "%", isAbnormal: false }] }],
    });

    const ctx = await getPatientContext("pat_1", { id: "u", role: "PATIENT", isActive: true, patient: { id: "pat_1" } });
    expect(ctx.firstName).toBe("Ada");
    expect(ctx.allergies).toContain("penicillin");
    expect(ctx.activeMedications[0].medication).toBe("lisinopril");
    expect(ctx.recentLabs[0].testName).toBe("HbA1c");
    expect(ctx.age).toBeGreaterThan(30);
  });

  it("throws when the patient is missing", async () => {
    findUnique.mockResolvedValue(null);
    await expect(getPatientContext("nope", { id: "u", role: "PATIENT", isActive: true, patient: { id: "nope" } })).rejects.toThrow(/not available/i);
  });
});
