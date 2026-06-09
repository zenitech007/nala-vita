import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: () => getUser() },
  }),
}));

const userFindUnique = jest.fn();
const patientFindUnique = jest.fn();
const $transaction = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    patient: { findUnique: (...a: unknown[]) => patientFindUnique(...a) },
    $transaction: (...a: unknown[]) => $transaction(...a),
  },
}));

const checkNewPrescriptionSafety = jest.fn();
jest.mock("@/lib/amelia/medsafety", () => ({
  checkNewPrescriptionSafety: (...a: unknown[]) => checkNewPrescriptionSafety(...a),
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
      id: "u1",
      firstName: "A",
      lastName: "B",
      doctor: { id: "doc1" },
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
    expect(checkNewPrescriptionSafety).toHaveBeenCalledWith("pat1", "Amoxicillin");
  });
});
