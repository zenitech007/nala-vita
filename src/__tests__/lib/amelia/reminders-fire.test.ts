// src/__tests__/lib/amelia/reminders-fire.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const findMany = jest.fn();
const update = jest.fn();
const createNotification = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: { reminder: { findMany: (...a: unknown[]) => findMany(...a), update: (...a: unknown[]) => update(...a) } },
}));
jest.mock("@/lib/notifications", () => ({ createNotification: (...a: unknown[]) => createNotification(...a) }));
jest.mock("@/lib/amelia/llm", () => ({ chat: jest.fn() }));

import { fireDueReminders } from "@/lib/amelia/reminders";

beforeEach(() => { findMany.mockReset(); update.mockReset(); createNotification.mockReset(); });

describe("fireDueReminders", () => {
  it("notifies, advances DAILY, deactivates ONCE", async () => {
    const now = new Date(2026, 5, 12, 8, 5, 0);
    findMany.mockResolvedValue([
      { id: "d1", kind: "MEDICATION", label: "BP meds", frequency: "DAILY", nextFireAt: new Date(2026, 5, 12, 8, 0) },
      { id: "o1", kind: "APPOINTMENT", label: "see Dr", frequency: "ONCE", nextFireAt: new Date(2026, 5, 12, 7, 0) },
    ]);
    update.mockResolvedValue({});
    createNotification.mockResolvedValue({});

    const fired = await fireDueReminders("pat1", "user1", now);

    expect(fired).toBe(2);
    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenCalledWith("user1", "Reminder", "BP meds", "REMINDER", { link: "/patient/amelia" });
    const dailyUpdate = update.mock.calls.find((c) => (c[0] as { where: { id: string } }).where.id === "d1")![0] as { data: { nextFireAt: Date } };
    expect(dailyUpdate.data.nextFireAt.getDate()).toBe(13);
    const onceUpdate = update.mock.calls.find((c) => (c[0] as { where: { id: string } }).where.id === "o1")![0] as { data: { active: boolean } };
    expect(onceUpdate.data.active).toBe(false);
  });

  it("returns 0 when nothing is due", async () => {
    findMany.mockResolvedValue([]);
    expect(await fireDueReminders("pat1", "user1", new Date(2026, 5, 12, 8, 0))).toBe(0);
    expect(createNotification).not.toHaveBeenCalled();
  });
});
