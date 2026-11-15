import {mockOf,mockQuery} from "../../helpers/mock";
import type {PatientProjection} from "../../helpers/projections";
jest.mock("@/lib/visible-patient-record", () => ({ loadVisiblePatientRecord: async () => { const row = await findUnique(); if (!row) throw new Error("Patient not available"); return { patient: { allergies: row.allergies }, prescriptions: (row.prescriptions??[]).map((p: object) => ({ ...p, isActive: true })) }; } }));
// src/__tests__/lib/amelia/medsafety-newrx.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
const chat=mockOf<typeof import("@/lib/amelia/llm").chat>();
const findUnique=mockQuery<PatientProjection|null>();
const createNotification = jest.fn();
jest.mock("@/lib/amelia/llm", () => ({ chat: (...a: Parameters<typeof chat>) => chat(...a) }));
jest.mock("@/lib/prisma", () => ({ prisma: { patient: { findUniqueOrThrow: (...a: unknown[]) => findUnique(...a) } } }));
jest.mock("@/lib/notifications", () => ({ createNotification: (...a: unknown[]) => createNotification(...a) }));

import { checkNewPrescriptionSafety } from "@/lib/amelia/medsafety";

beforeEach(() => { chat.mockReset(); findUnique.mockReset(); createNotification.mockReset(); });

describe("checkNewPrescriptionSafety", () => {
  it("notifies when a high-severity interaction involves the new med", async () => {
    findUnique.mockResolvedValue({ userId: "u1", allergies: [], prescriptions: [{ medication: "warfarin", dosage: "5mg" }, { medication: "aspirin", dosage: "81mg" }] });
    chat.mockResolvedValue('{"interactions":[{"drugs":["aspirin","warfarin"],"severity":"high","note":"bleeding"}],"dosingNotes":[],"allergyConflicts":[],"overallNote":"x"}');
    await checkNewPrescriptionSafety("pat1", "aspirin", { id: "u1", role: "PATIENT", isActive: true, patient: { id: "pat1" } });
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith("u1", "Medication safety", expect.any(String), "MED_SAFETY", { link: "/patient/medications" });
  });

  it("stays silent when no concern involves the new med", async () => {
    findUnique.mockResolvedValue({ userId: "u1", allergies: [], prescriptions: [{ medication: "aspirin", dosage: "81mg" }] });
    chat.mockResolvedValue('{"interactions":[],"dosingNotes":[],"allergyConflicts":[],"overallNote":"ok"}');
    await checkNewPrescriptionSafety("pat1", "aspirin", { id: "u1", role: "PATIENT", isActive: true, patient: { id: "pat1" } });
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("no-ops when the patient is missing", async () => {
    findUnique.mockResolvedValue(null);
    await expect(checkNewPrescriptionSafety("nope", "x", { id: "u1", role: "PATIENT", isActive: true, patient: { id: "nope" } })).rejects.toThrow("Patient not available");
    expect(chat).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });
});
