/**
 * Unit tests for the HIPAA audit log utility.
 *
 * We mock Prisma so no database connection is needed.
 */

import { logAudit } from "@/lib/audit";

// Mock the Prisma client
jest.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      create: jest.fn(),
    },
  },
}));

// Mock env import (no-op for tests)
jest.mock("@/lib/env", () => ({}));

import { prisma } from "@/lib/prisma";

const mockCreate = prisma.auditLog.create as jest.Mock;

beforeEach(() => {
  mockCreate.mockClear();
  mockCreate.mockResolvedValue({ id: "audit-1" });
});

describe("logAudit", () => {
  it("creates an audit log entry with correct fields", async () => {
    await logAudit({
      userId: "user-123",
      action: "read",
      resourceType: "patient_record",
      resourceId: "rec-456",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-123",
        action: "READ",
        resourceType: "PATIENT_RECORD",
        resourceId: "rec-456",
        metadata: null,
      }),
    });
  });

  it("uppercases action and resourceType", async () => {
    await logAudit({
      userId: "u1",
      action: "create",
      resourceType: "prescription",
      resourceId: "p1",
    });

    const call = mockCreate.mock.calls[0][0].data;
    expect(call.action).toBe("CREATE");
    expect(call.resourceType).toBe("PRESCRIPTION");
  });

  it("strips PHI fields from metadata", async () => {
    await logAudit({
      userId: "u1",
      action: "UPDATE",
      resourceType: "PATIENT_RECORD",
      resourceId: "r1",
      metadata: {
        appointmentId: "apt-1",
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "555-1234",
        dob: "1990-01-01",
        status: "COMPLETED",
      },
    });

    const call = mockCreate.mock.calls[0][0].data;
    const meta = JSON.parse(call.metadata);

    // Non-PHI fields should be preserved
    expect(meta.appointmentId).toBe("apt-1");
    expect(meta.status).toBe("COMPLETED");

    // PHI fields should be redacted
    expect(meta.name).toBe("[REDACTED]");
    expect(meta.email).toBe("[REDACTED]");
    expect(meta.phone).toBe("[REDACTED]");
    expect(meta.dob).toBe("[REDACTED]");
  });

  it("does not throw if prisma.auditLog.create fails", async () => {
    mockCreate.mockRejectedValue(new Error("DB connection lost"));

    await expect(
      logAudit({ userId: "u1", action: "READ", resourceType: "RECORD", resourceId: "r1" })
    ).resolves.toBeUndefined();
  });
});
