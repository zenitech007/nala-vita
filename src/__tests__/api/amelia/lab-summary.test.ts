import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: () => ({ auth: { getUser: () => getUser() } }) }));
const userFindUnique = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => userFindUnique(...a) } } }));
jest.mock("@/lib/rate-limit", () => ({ checkRateLimitAsync: async () => ({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 }) }));
const chat = jest.fn();
jest.mock("@/lib/amelia/llm", () => ({ chat: (...a: unknown[]) => chat(...a) }));

import { POST } from "@/app/api/ai/lab-summary/route";

function req(body: unknown) {
  return new Request("http://localhost/api/ai/lab-summary", { method: "POST", body: JSON.stringify(body) }) as never;
}

beforeEach(() => [getUser, userFindUnique, chat].forEach((m) => m.mockReset()));

describe("POST /api/ai/lab-summary", () => {
  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ testName: "CBC", results: [{ resultValue: "5" }] }));
    expect(res.status).toBe(401);
  });

  it("returns a plain-language summary", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1" });
    chat.mockResolvedValue("Your results look mostly normal. Please confirm with a doctor.");
    const res = await POST(req({ testName: "HbA1c", results: [{ resultValue: "6.1", unit: "%", isAbnormal: false }] }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.summary).toMatch(/normal/);
  });
});
