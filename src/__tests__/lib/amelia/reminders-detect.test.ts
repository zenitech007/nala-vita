// src/__tests__/lib/amelia/reminders-detect.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const chat = jest.fn();
jest.mock("@/lib/amelia/llm", () => ({ chat: (...a: unknown[]) => chat(...a) }));
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/notifications", () => ({ createNotification: jest.fn() }));

import { detectReminder, computeNextFireAt, describeSchedule } from "@/lib/amelia/reminders";
import type { ReminderCandidate } from "@/lib/amelia/types";

beforeEach(() => chat.mockReset());

describe("detectReminder", () => {
  it("returns null when the patient isn't asking for a reminder", async () => {
    chat.mockResolvedValue("null");
    expect(await detectReminder("what is a fever?", "A fever is...")).toBeNull();
  });

  it("parses a DAILY reminder", async () => {
    chat.mockResolvedValue('{"kind":"MEDICATION","label":"take BP meds","frequency":"DAILY","hour":8,"minute":0}');
    const c = await detectReminder("remind me to take my BP meds at 8am", "Sure!");
    expect(c).toEqual({ kind: "MEDICATION", label: "take BP meds", frequency: "DAILY", hour: 8, minute: 0 });
  });

  it("rejects an invalid kind", async () => {
    chat.mockResolvedValue('{"kind":"NOPE","label":"x","frequency":"DAILY","hour":8,"minute":0}');
    expect(await detectReminder("x", "y")).toBeNull();
  });
});

describe("computeNextFireAt", () => {
  it("DAILY picks today if the time is still ahead", () => {
    const now = new Date(2026, 5, 12, 6, 0, 0);
    const c: ReminderCandidate = { kind: "MEDICATION", label: "m", frequency: "DAILY", hour: 8, minute: 0 };
    const next = computeNextFireAt(c, now);
    expect(next.getDate()).toBe(12);
    expect(next.getHours()).toBe(8);
  });

  it("DAILY rolls to tomorrow if the time already passed", () => {
    const now = new Date(2026, 5, 12, 9, 0, 0);
    const c: ReminderCandidate = { kind: "MEDICATION", label: "m", frequency: "DAILY", hour: 8, minute: 0 };
    expect(computeNextFireAt(c, now).getDate()).toBe(13);
  });

  it("ONCE uses the given datetime", () => {
    const now = new Date(2026, 5, 12, 9, 0, 0);
    const iso = new Date(2026, 5, 14, 14, 0, 0).toISOString();
    const c: ReminderCandidate = { kind: "APPOINTMENT", label: "appt", frequency: "ONCE", isoDateTime: iso };
    expect(computeNextFireAt(c, now).toISOString()).toBe(iso);
  });
});

describe("describeSchedule", () => {
  it("formats DAILY", () => {
    expect(describeSchedule("DAILY", new Date(2026, 5, 12, 8, 0))).toBe("every day at 8:00 AM");
  });
  it("formats ONCE", () => {
    expect(describeSchedule("ONCE", new Date(2026, 5, 12, 14, 30))).toMatch(/on Jun 12 at 2:30 PM/);
  });
});
