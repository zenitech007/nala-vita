// src/lib/amelia/reminders.ts
import { prisma } from "@/lib/prisma";
import { chat } from "./llm";
import { nextDailyFireAt, reminderLocalClock } from "@/lib/reminder-schedule";
import { isIanaTimeZone } from "@/lib/appointment-availability";
import type { ReminderKind, ReminderFrequency, ReminderCandidate, ReminderRecord } from "./types";

const VALID_KINDS: ReminderKind[] = ["MEDICATION", "APPOINTMENT", "VITALS", "OTHER"];

export function describeSchedule(frequency: ReminderFrequency, nextFireAt: Date, timeZone: string): string {
  if (!isIanaTimeZone(timeZone)) return "Timezone required. Save your timezone in Settings and recreate this reminder.";
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(nextFireAt);
  if (frequency === "DAILY") return `every day at ${time} (${timeZone})`;
  const date = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(nextFireAt);
  return `on ${date} at ${time} (${timeZone})`;
}

export function computeNextFireAt(candidate: ReminderCandidate, now: Date, timeZone: string): Date {
  if (!isIanaTimeZone(timeZone)) throw new Error("Timezone required.");
  if (candidate.frequency === "ONCE") {
    if (!candidate.isoDateTime || !Number.isFinite(Date.parse(candidate.isoDateTime))) throw new Error("Reminder date required.");
    return new Date(candidate.isoDateTime);
  }
  return nextDailyFireAt(candidate.hour ?? 8, candidate.minute ?? 0, timeZone, now);
}

export async function detectReminder(userText: string, assistantText: string): Promise<ReminderCandidate | null> {
  const raw = await chat(
    [
      {
        role: "system",
        content:
          'Decide if the patient is asking to be reminded about something. If NOT, return exactly null. If YES, return ONLY a JSON object {"kind","label","frequency","hour","minute","isoDateTime"} where kind is MEDICATION|APPOINTMENT|VITALS|OTHER and frequency is DAILY or ONCE. For DAILY include hour (0-23) and minute (0-59). For ONCE include isoDateTime (ISO 8601). label is a short phrase like "take BP meds". No prose, no code fences.',
      },
      { role: "user", content: `Patient said: ${userText}\nAmelia replied: ${assistantText}` },
    ],
    { temperature: 0, maxTokens: 200 }
  );

  let parsed: unknown;
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    if (cleaned === "null" || cleaned === "") return null;
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const c = parsed as Record<string, unknown>;
  if (!VALID_KINDS.includes(c.kind as ReminderKind)) return null;
  if (c.frequency !== "DAILY" && c.frequency !== "ONCE") return null;
  if (typeof c.label !== "string" || c.label.trim().length === 0) return null;

  const candidate: ReminderCandidate = {
    kind: c.kind as ReminderKind,
    label: (c.label as string).trim(),
    frequency: c.frequency as ReminderFrequency,
  };
  if (candidate.frequency === "DAILY") {
    candidate.hour = typeof c.hour === "number" ? c.hour : 8;
    candidate.minute = typeof c.minute === "number" ? c.minute : 0;
  } else {
    if (typeof c.isoDateTime !== "string") return null;
    candidate.isoDateTime = c.isoDateTime;
  }
  return candidate;
}

export async function createReminder(
  patientId: string,
  data: { kind: ReminderKind; label: string; frequency: ReminderFrequency; nextFireAt: Date; timeZone: string }
): Promise<void> {
  if (!isIanaTimeZone(data.timeZone)) throw new Error("Timezone required.");
  const { hour, minute } = reminderLocalClock(data.nextFireAt, data.timeZone);
  await prisma.reminder.create({
    data: {
      patientId, kind: data.kind, label: data.label, frequency: data.frequency,
      nextFireAt: data.nextFireAt, timeZone: data.timeZone,
      localHour: data.frequency === "DAILY" ? hour : null,
      localMinute: data.frequency === "DAILY" ? minute : null,
    },
  });
}

export async function listReminders(patientId: string): Promise<ReminderRecord[]> {
  const rows = await prisma.reminder.findMany({ where: { patientId, active: true }, orderBy: { nextFireAt: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as ReminderKind,
    label: r.label,
    frequency: r.frequency as ReminderFrequency,
    nextFireAt: r.nextFireAt.toISOString(),
    schedule: describeSchedule(r.frequency as ReminderFrequency, r.nextFireAt, r.timeZone ?? ""),
  }));
}

export async function cancelReminder(id: string, patientId: string): Promise<void> {
  await prisma.reminder.updateMany({ where: { id, patientId }, data: { active: false } });
}
