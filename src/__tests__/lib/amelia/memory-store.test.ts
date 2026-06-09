// src/__tests__/lib/amelia/memory-store.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const findMany = jest.fn();
const createMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: { ameliaMemory: { findMany: (...a: unknown[]) => findMany(...a), createMany: (...a: unknown[]) => createMany(...a) } },
}));
jest.mock("@/lib/amelia/llm", () => ({ chat: jest.fn() }));

import { saveMemories, getMemoriesForGrounding } from "@/lib/amelia/memory";

beforeEach(() => { findMany.mockReset(); createMany.mockReset(); });

describe("saveMemories", () => {
  it("dedupes and sets confirmedByUser by stakes", async () => {
    findMany.mockResolvedValue([{ kind: "ALLERGY", value: "penicillin" }]);
    createMany.mockResolvedValue({ count: 2 });
    await saveMemories("pat1", [
      { kind: "ALLERGY", value: "Penicillin" },
      { kind: "CONDITION", value: "asthma" },
      { kind: "PREFERENCE", value: "morning visits" },
    ], "msg1");
    expect(createMany).toHaveBeenCalledTimes(1);
    const rows = (createMany.mock.calls[0][0] as { data: { kind: string; confirmedByUser: boolean }[] }).data;
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.kind === "CONDITION")!.confirmedByUser).toBe(false);
    expect(rows.find((r) => r.kind === "PREFERENCE")!.confirmedByUser).toBe(true);
  });

  it("no-ops when nothing fresh", async () => {
    findMany.mockResolvedValue([{ kind: "CONDITION", value: "asthma" }]);
    await saveMemories("pat1", [{ kind: "CONDITION", value: "asthma" }]);
    expect(createMany).not.toHaveBeenCalled();
  });
});

describe("getMemoriesForGrounding", () => {
  it("splits known vs toConfirm by stakes + confirmation", async () => {
    findMany.mockResolvedValue([
      { id: "1", kind: "ALLERGY", value: "penicillin", confirmedByUser: false },
      { id: "2", kind: "ALLERGY", value: "sulfa", confirmedByUser: true },
      { id: "3", kind: "PREFERENCE", value: "mornings", confirmedByUser: false },
    ]);
    const out = await getMemoriesForGrounding("pat1");
    expect(out.toConfirm.map((m) => m.id)).toEqual(["1"]);
    expect(out.known.map((m) => m.id).sort()).toEqual(["2", "3"]);
  });
});
