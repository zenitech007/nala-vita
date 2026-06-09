// src/__tests__/api/amelia/memory.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: () => ({ auth: { getUser: () => getUser() } }) }));
const userFindUnique = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => userFindUnique(...a) } } }));
const listMemories = jest.fn();
const confirmMemory = jest.fn();
const updateMemory = jest.fn();
const deleteMemory = jest.fn();
jest.mock("@/lib/amelia/memory", () => ({
  listMemories: (...a: unknown[]) => listMemories(...a),
  confirmMemory: (...a: unknown[]) => confirmMemory(...a),
  updateMemory: (...a: unknown[]) => updateMemory(...a),
  deleteMemory: (...a: unknown[]) => deleteMemory(...a),
}));

import { GET } from "@/app/api/amelia/memory/route";
import { PATCH, DELETE } from "@/app/api/amelia/memory/[id]/route";

function req(body?: unknown) {
  return new Request("http://localhost/api/amelia/memory", { method: "POST", body: body ? JSON.stringify(body) : undefined }) as never;
}
const ctx = (id: string) => ({ params: { id } });

beforeEach(() => [getUser, userFindUnique, listMemories, confirmMemory, updateMemory, deleteMemory].forEach((m) => m.mockReset()));

describe("memory API", () => {
  it("GET 401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("GET returns the patient's memories", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    listMemories.mockResolvedValue([{ id: "1", kind: "ALLERGY", value: "penicillin", confirmedByUser: true }]);
    const res = await GET(req());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.memories[0].value).toBe("penicillin");
    expect(listMemories).toHaveBeenCalledWith("pat1");
  });

  it("PATCH confirm calls confirmMemory scoped to the patient", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    confirmMemory.mockResolvedValue(undefined);
    const res = await PATCH(req({ action: "confirm" }), ctx("m1"));
    expect(res.status).toBe(200);
    expect(confirmMemory).toHaveBeenCalledWith("m1", "pat1");
  });

  it("DELETE removes the memory scoped to the patient", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    deleteMemory.mockResolvedValue(undefined);
    const res = await DELETE(req(), ctx("m1"));
    expect(res.status).toBe(200);
    expect(deleteMemory).toHaveBeenCalledWith("m1", "pat1");
  });

  it("DELETE returns 500 when the delete fails", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    deleteMemory.mockRejectedValue(new Error("db down"));
    const res = await DELETE(req(), ctx("m1"));
    expect(res.status).toBe(500);
  });
});
