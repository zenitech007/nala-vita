// src/__tests__/lib/amelia/memory-crud.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const findMany = jest.fn();
const updateMany = jest.fn();
const deleteMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: { ameliaMemory: {
    findMany: (...a: unknown[]) => findMany(...a),
    updateMany: (...a: unknown[]) => updateMany(...a),
    deleteMany: (...a: unknown[]) => deleteMany(...a),
  } },
}));
jest.mock("@/lib/amelia/llm", () => ({ chat: jest.fn() }));

import { listMemories, confirmMemory, updateMemory, deleteMemory } from "@/lib/amelia/memory";

beforeEach(() => { findMany.mockReset(); updateMany.mockReset(); deleteMany.mockReset(); });

describe("memory CRUD (patient-scoped)", () => {
  it("lists memories as facts", async () => {
    findMany.mockResolvedValue([{ id: "1", kind: "ALLERGY", value: "penicillin", confirmedByUser: true }]);
    const out = await listMemories("pat1");
    expect(out).toEqual([{ id: "1", kind: "ALLERGY", value: "penicillin", confirmedByUser: true }]);
  });

  it("confirm/update/delete are scoped by both id AND patientId", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    deleteMany.mockResolvedValue({ count: 1 });
    await confirmMemory("m1", "pat1");
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "m1", patientId: "pat1" }, data: { confirmedByUser: true } });
    await updateMemory("m1", "pat1", "new value");
    expect(updateMany).toHaveBeenLastCalledWith({ where: { id: "m1", patientId: "pat1" }, data: { value: "new value" } });
    await deleteMemory("m1", "pat1");
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "m1", patientId: "pat1" } });
  });
});
