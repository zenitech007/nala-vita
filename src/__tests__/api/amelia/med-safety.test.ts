import {mockOf,mockQuery} from "../../helpers/mock";
import type {AuthReply,UserProjection} from "../../helpers/projections";
jest.mock("@/lib/visible-patient-record", () => ({ loadVisiblePatientRecord: async () => ({ patient: { allergies: ["penicillin"] }, prescriptions: [{ medication: "Aspirin", dosage: "81mg", isActive: true }] }) }));
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser=mockQuery<AuthReply>();
jest.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: () => getUser() },
  }),
}));

const userFindUnique=mockQuery<UserProjection|null>();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
  },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimitAsync: async () => ({
    allowed: true,
    remaining: 9,
    resetAt: Date.now() + 60000,
  }),
}));

const getCachedOrAnalyze=mockOf<typeof import("@/lib/amelia/medsafety").getCachedOrAnalyze>();
jest.mock("@/lib/amelia/medsafety", () => ({
  getCachedOrAnalyze: (...a: Parameters<typeof getCachedOrAnalyze>) => getCachedOrAnalyze(...a),
}));

import { GET } from "@/app/api/amelia/med-safety/route";


beforeEach(() => {
  [getUser, userFindUnique, getCachedOrAnalyze].forEach((m) => m.mockReset());
});

describe("GET /api/amelia/med-safety", () => {
  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET()).status).toBe(401);
  });

  it("returns the analysis for the patient's active meds", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    userFindUnique.mockResolvedValue({
      id: "u1", role: "PATIENT", isActive: true,
      patient: {
        id: "pat1",
        allergies: ["penicillin"],
        prescriptions: [{ medication: "Aspirin", dosage: "81mg" }],
      },
    });
    getCachedOrAnalyze.mockResolvedValue({status:"available",
      interactions: [],
      dosingNotes: [],
      allergyConflicts: [],
      overallNote: "ok",
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.result.overallNote).toBe("ok");
    expect(getCachedOrAnalyze).toHaveBeenCalledWith("pat1", [{ medication: "Aspirin", dosage: "81mg" }], ["penicillin"]);
  });
});
