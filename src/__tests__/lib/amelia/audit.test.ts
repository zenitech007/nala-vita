// src/__tests__/lib/amelia/audit.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const create = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { auditLog: { create: (...a: unknown[]) => create(...a) } } }));

import { stripPhi, logAmeliaAudit } from "@/lib/amelia/audit";

beforeEach(() => create.mockReset());

describe("amelia audit", () => {
  it("strips emails and phone numbers", () => {
    expect(stripPhi("reach me at ada@x.com or 080-1234-5678")).not.toMatch(/ada@x\.com/);
    expect(stripPhi("call 08012345678")).toMatch(/\[phone\]/);
  });

  it("writes a PHI-stripped AuditLog row", async () => {
    create.mockResolvedValue({});
    await logAmeliaAudit({ userId: "u1", action: "amelia.chat", conversationId: "c1", summary: "email ada@x.com urgency=routine" });
    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0] as { data: { metadata: string; resourceType: string } };
    expect(arg.data.metadata).not.toMatch(/ada@x\.com/);
    expect(arg.data.resourceType).toBe("AmeliaConversation");
  });
});
