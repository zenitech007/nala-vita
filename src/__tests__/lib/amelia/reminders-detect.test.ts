import {mockOf} from "../../helpers/mock";
// src/__tests__/lib/amelia/reminders-detect.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const chat=mockOf<typeof import("@/lib/amelia/llm").chat>();
jest.mock("@/lib/amelia/llm", () => ({ chat: (...a: Parameters<typeof chat>) => chat(...a) }));
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/notifications", () => ({ createNotification: jest.fn() }));

import { detectReminder, computeNextFireAt, describeSchedule } from "@/lib/amelia/reminders";
import type { ReminderCandidate } from "@/lib/amelia/types";

beforeEach(() => {chat.mockReset();});

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
    const now = new Date("2026-06-12T06:00:00Z");
    const c: ReminderCandidate = { kind: "MEDICATION", label: "m", frequency: "DAILY", hour: 8, minute: 0 };
    const next = computeNextFireAt(c, now, "UTC");
    expect(next.getUTCDate()).toBe(12);
    expect(next.getUTCHours()).toBe(8);
  });

  it("DAILY rolls to tomorrow if the time already passed", () => {
    const now = new Date("2026-06-12T09:00:00Z");
    const c: ReminderCandidate = { kind: "MEDICATION", label: "m", frequency: "DAILY", hour: 8, minute: 0 };
    expect(computeNextFireAt(c, now, "UTC").getUTCDate()).toBe(13);
  });

  it("ONCE uses the given datetime", () => {
    const now = new Date("2026-06-12T09:00:00Z");
    const iso = new Date(2026, 5, 14, 14, 0, 0).toISOString();
    const c: ReminderCandidate = { kind: "APPOINTMENT", label: "appt", frequency: "ONCE", isoDateTime: iso };
    expect(computeNextFireAt(c, now, "UTC").toISOString()).toBe(iso);
  });
});

describe("describeSchedule", () => {
  it("formats DAILY", () => {
    expect(describeSchedule("DAILY", new Date("2026-06-12T08:00:00Z"), "UTC")).toBe("every day at 8:00 AM (UTC)");
  });
  it("formats ONCE", () => {
    expect(describeSchedule("ONCE", new Date("2026-06-12T14:30:00Z"), "UTC")).toMatch(/on Jun 12 at 2:30 PM/);
  });
});
