import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: () => getUser() },
  }),
}));

const userFindUnique = jest.fn();
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

const getCachedOrAnalyze = jest.fn();
jest.mock("@/lib/amelia/medsafety", () => ({
  getCachedOrAnalyze: (...a: unknown[]) => getCachedOrAnalyze(...a),
}));

import { GET } from "@/app/api/amelia/med-safety/route";

function req() {
  return new Request("http://localhost/api/amelia/med-safety") as never;
}

beforeEach(() => {
  [getUser, userFindUnique, getCachedOrAnalyze].forEach((m) => m.mockReset());
});

describe("GET /api/amelia/med-safety", () => {
  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET(req())).status).toBe(401);
  });

  it("returns the analysis for the patient's active meds", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    userFindUnique.mockResolvedValue({
      id: "u1",
      patient: {
        id: "pat1",
        allergies: ["penicillin"],
        prescriptions: [{ medication: "Aspirin", dosage: "81mg" }],
      },
    });
    getCachedOrAnalyze.mockResolvedValue({
      interactions: [],
      dosingNotes: [],
      allergyConflicts: [],
      overallNote: "ok",
    });

    const res = await GET(req());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.result.overallNote).toBe("ok");
    expect(getCachedOrAnalyze).toHaveBeenCalledWith("pat1", [{ medication: "Aspirin", dosage: "81mg" }], ["penicillin"]);
  });
});
