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
    const when = new Date("2026-06-12T08:00:00Z");
    await createReminder("pat1", { kind: "MEDICATION", label: "BP meds", frequency: "DAILY", nextFireAt: when, timeZone: "UTC" });
    expect(create).toHaveBeenCalledWith({ data: { patientId: "pat1", kind: "MEDICATION", label: "BP meds", frequency: "DAILY", nextFireAt: when, timeZone: "UTC", localHour: 8, localMinute: 0 } });
  });

  it("lists active reminders with a human schedule", async () => {
    findMany.mockResolvedValue([{ id: "1", kind: "MEDICATION", label: "BP meds", frequency: "DAILY", nextFireAt: new Date("2026-06-12T08:00:00Z"), timeZone: "UTC" }]);
    const out = await listReminders("pat1");
    expect(out[0].schedule).toBe("every day at 8:00 AM (UTC)");
    expect(out[0].id).toBe("1");
  });

  it("cancels scoped by id AND patientId", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await cancelReminder("r1", "pat1");
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "r1", patientId: "pat1" }, data: { active: false } });
  });
});


it("labels legacy timezone-free reminders as requiring recreation", async () => {
  findMany.mockResolvedValue([{ id: "old", kind: "OTHER", label: "old", frequency: "DAILY", nextFireAt: new Date(0), timeZone: null }]);
  expect((await listReminders("pat1"))[0].schedule).toMatch(/Timezone required/);
});
