// src/__tests__/lib/amelia/reminders-crud.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const create = jest.fn();
const findMany = jest.fn();
const updateMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: { reminder: {
    create: (...a: unknown[]) => create(...a),
    findMany: (...a: unknown[]) => findMany(...a),
    updateMany: (...a: unknown[]) => updateMany(...a),
  } },
}));
jest.mock("@/lib/amelia/llm", () => ({ chat: jest.fn() }));
jest.mock("@/lib/notifications", () => ({ createNotification: jest.fn() }));

import { createReminder, listReminders, cancelReminder } from "@/lib/amelia/reminders";

beforeEach(() => { create.mockReset(); findMany.mockReset(); updateMany.mockReset(); });

describe("reminder CRUD (patient-scoped)", () => {
  it("creates a reminder", async () => {
    create.mockResolvedValue({});
    const when = new Date(2026, 5, 12, 8, 0);
    await createReminder("pat1", { kind: "MEDICATION", label: "BP meds", frequency: "DAILY", nextFireAt: when });
    expect(create).toHaveBeenCalledWith({ data: { patientId: "pat1", kind: "MEDICATION", label: "BP meds", frequency: "DAILY", nextFireAt: when } });
  });

  it("lists active reminders with a human schedule", async () => {
    findMany.mockResolvedValue([{ id: "1", kind: "MEDICATION", label: "BP meds", frequency: "DAILY", nextFireAt: new Date(2026, 5, 12, 8, 0) }]);
    const out = await listReminders("pat1");
    expect(out[0].schedule).toBe("every day at 8:00 AM");
    expect(out[0].id).toBe("1");
  });

  it("cancels scoped by id AND patientId", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await cancelReminder("r1", "pat1");
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "r1", patientId: "pat1" }, data: { active: false } });
  });
});
