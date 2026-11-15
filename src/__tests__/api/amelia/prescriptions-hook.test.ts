import {mockOf,mockQuery} from "../../helpers/mock";
import type {AuthReply,UserProjection,PatientProjection} from "../../helpers/projections";
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser=mockQuery<AuthReply>();
jest.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: () => getUser() },
  }),
}));

const userFindUnique=mockQuery<UserProjection|null>();
const patientFindUnique=mockQuery<PatientProjection|null>();
const $transaction=mockQuery<{prescription:Partial<import("@prisma/client").Prescription>;notification:Partial<import("@prisma/client").Notification>}>();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    patient: { findUnique: (...a: unknown[]) => patientFindUnique(...a) },
    appointment: {findFirst: async()=>({id:"care"})},
    referral: {findFirst: async()=>null},
    $transaction: (...a: unknown[]) => $transaction(...a),
  },
}));

const checkNewPrescriptionSafety=mockOf<typeof import("@/lib/amelia/medsafety").checkNewPrescriptionSafety>();
jest.mock("@/lib/amelia/medsafety", () => ({
  checkNewPrescriptionSafety: (...a: Parameters<typeof checkNewPrescriptionSafety>) => checkNewPrescriptionSafety(...a),
}));

import { POST } from "@/app/api/prescriptions/route";

function req(body: unknown) {
  return new Request("http://localhost/api/prescriptions", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  [getUser, userFindUnique, patientFindUnique, $transaction, checkNewPrescriptionSafety].forEach((m) => m.mockReset());
});

describe("POST /api/prescriptions med-safety hook", () => {
  it("calls checkNewPrescriptionSafety after a successful create", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({
      id: "u1", role: "DOCTOR", isActive: true,
      firstName: "A",
      lastName: "B",
      doctor: { id: "doc1", isVerified: true },
    });
    patientFindUnique.mockResolvedValue({
      id: "pat1",
      userId: "pu1",
      user: {},
    });
    $transaction.mockResolvedValue({
      prescription: { id: "rx1" },
      notification: {},
    });
    checkNewPrescriptionSafety.mockResolvedValue(undefined);

    const res = await POST(
      req({
        patientId: "pat1",
        medication: "Amoxicillin",
        dosage: "500mg",
        frequency: "TID",
        duration: "7 days",
      })
    );
    expect(res.status).toBe(201);
    expect(checkNewPrescriptionSafety).toHaveBeenCalledWith("pat1", "Amoxicillin", expect.objectContaining({ doctor: { id: "doc1", isVerified: true } }));
  });
});
