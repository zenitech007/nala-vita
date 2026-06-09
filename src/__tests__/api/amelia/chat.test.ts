import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: () => ({ auth: { getUser: () => getUser() } }) }));

const userFindUnique = jest.fn();
const convoFindFirst = jest.fn();
const convoCreate = jest.fn();
const msgCreate = jest.fn();
const msgFindMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    ameliaConversation: { findFirst: (...a: unknown[]) => convoFindFirst(...a), create: (...a: unknown[]) => convoCreate(...a) },
    ameliaMessage: { create: (...a: unknown[]) => msgCreate(...a), findMany: (...a: unknown[]) => msgFindMany(...a) },
  },
}));

jest.mock("@/lib/rate-limit", () => ({ checkRateLimitAsync: async () => ({ allowed: true, remaining: 19, resetAt: Date.now() + 60000 }) }));
const runAmeliaTurn = jest.fn();
jest.mock("@/lib/amelia/engine", () => ({ runAmeliaTurn: (...a: unknown[]) => runAmeliaTurn(...a) }));
jest.mock("@/lib/amelia/audit", () => ({ logAmeliaAudit: async () => undefined }));

import { POST } from "@/app/api/amelia/chat/route";

function req(body: unknown) {
  return new Request("http://localhost/api/amelia/chat", { method: "POST", body: JSON.stringify(body) }) as never;
}

beforeEach(() => {
  [getUser, userFindUnique, convoFindFirst, convoCreate, msgCreate, msgFindMany, runAmeliaTurn].forEach((m) => m.mockReset());
});

describe("POST /api/amelia/chat", () => {
  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ message: "hi" }));
    expect(res.status).toBe(401);
  });

  it("returns Amelia's reply on the happy path", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub-1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    convoCreate.mockResolvedValue({ id: "c1" });
    msgCreate.mockResolvedValue({});
    msgFindMany.mockResolvedValue([{ role: "user", content: "I have a sore throat" }]);
    runAmeliaTurn.mockResolvedValue({ content: "Advice. Confirm with a doctor.", urgency: "routine", redFlags: [], disclaimer: "d" });

    const res = await POST(req({ message: "I have a sore throat" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.conversationId).toBe("c1");
    expect(json.reply.content).toMatch(/Advice/);
  });
});
