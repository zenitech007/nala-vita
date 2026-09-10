// src/__tests__/lib/amelia/conversations.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const convoFindMany = jest.fn();
const convoFindFirst = jest.fn();
const convoDeleteMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    ameliaConversation: {
      findMany: (...a: unknown[]) => convoFindMany(...a),
      findFirst: (...a: unknown[]) => convoFindFirst(...a),
      deleteMany: (...a: unknown[]) => convoDeleteMany(...a),
    },
  },
}));

import {
  deriveTitle,
  listConversations,
  getConversation,
  getLatestConversation,
  deleteConversation,
} from "@/lib/amelia/conversations";

beforeEach(() => {
  [convoFindMany, convoFindFirst, convoDeleteMany].forEach((m) => m.mockReset());
});

describe("deriveTitle", () => {
  it("uses the first user message", () => {
    expect(deriveTitle("Why is my thumb swollen?")).toBe("Why is my thumb swollen?");
  });

  it("collapses whitespace and newlines", () => {
    expect(deriveTitle("  my   thumb\nis  swollen ")).toBe("my thumb is swollen");
  });

  it("truncates long messages at a word boundary with an ellipsis", () => {
    const long =
      "My front door key has gotten really sticky lately and I cannot work out why it happens";
    const title = deriveTitle(long);
    expect(title.length).toBeLessThanOrEqual(62);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toMatch(/\s…$/); // no dangling space before the ellipsis
  });

  it("falls back for a missing or blank message", () => {
    expect(deriveTitle(undefined)).toBe("New conversation");
    expect(deriveTitle("   ")).toBe("New conversation");
  });
});

describe("listConversations", () => {
  it("returns newest-first summaries titled from the first user message", async () => {
    convoFindMany.mockResolvedValue([
      { id: "c2", updatedAt: new Date("2026-08-02T09:00:00Z"), messages: [{ content: "lipstick wears unevenly" }] },
      { id: "c1", updatedAt: new Date("2026-08-01T09:00:00Z"), messages: [] },
    ]);

    const out = await listConversations("pat1");

    expect(out).toEqual([
      { id: "c2", title: "lipstick wears unevenly", updatedAt: "2026-08-02T09:00:00.000Z" },
      { id: "c1", title: "New conversation", updatedAt: "2026-08-01T09:00:00.000Z" },
    ]);
    // Ordering and patient scoping must be enforced in the query.
    const arg = convoFindMany.mock.calls[0][0] as { where: { patientId: string }; orderBy: unknown };
    expect(arg.where.patientId).toBe("pat1");
    expect(arg.orderBy).toEqual({ updatedAt: "desc" });
  });
});

describe("getConversation", () => {
  it("maps messages to the UI shape", async () => {
    convoFindFirst.mockResolvedValue({
      id: "c1",
      messages: [
        { id: "m1", role: "user", content: "hi", createdAt: new Date("2026-08-01T09:00:00Z") },
        { id: "m2", role: "assistant", content: "hello", createdAt: new Date("2026-08-01T09:00:02Z") },
      ],
    });

    const out = await getConversation("c1", "pat1");
    expect(out?.messages).toEqual([
      { id: "m1", role: "user", content: "hi", sentAt: "2026-08-01T09:00:00.000Z" },
      { id: "m2", role: "assistant", content: "hello", sentAt: "2026-08-01T09:00:02.000Z" },
    ]);
  });

  it("returns null when the conversation belongs to another patient", async () => {
    convoFindFirst.mockResolvedValue(null);
    expect(await getConversation("c1", "someone-else")).toBeNull();
    // Scoped by patientId, so a foreign id simply misses.
    expect((convoFindFirst.mock.calls[0][0] as { where: { patientId: string } }).where.patientId).toBe("someone-else");
  });
});

describe("getLatestConversation", () => {
  it("returns null when the patient has no history", async () => {
    convoFindFirst.mockResolvedValueOnce(null);
    expect(await getLatestConversation("pat1")).toBeNull();
  });

  it("loads the most recently updated conversation", async () => {
    convoFindFirst
      .mockResolvedValueOnce({ id: "c9" })
      .mockResolvedValueOnce({ id: "c9", messages: [{ id: "m1", role: "user", content: "hi", createdAt: new Date("2026-08-03T09:00:00Z") }] });

    const out = await getLatestConversation("pat1");
    expect(out?.id).toBe("c9");
    expect(out?.messages).toHaveLength(1);
  });
});

describe("deleteConversation", () => {
  it("scopes the delete to the owning patient", async () => {
    convoDeleteMany.mockResolvedValue({ count: 1 });
    await deleteConversation("c1", "pat1");
    expect(convoDeleteMany).toHaveBeenCalledWith({ where: { id: "c1", patientId: "pat1" } });
  });
});
