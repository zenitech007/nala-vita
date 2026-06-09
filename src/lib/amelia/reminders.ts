// src/lib/amelia/reminders.ts
import { prisma } from "@/lib/prisma";
import { chat } from "./llm";
import { createNotification } from "@/lib/notifications";
import type { ReminderKind, ReminderFrequency, ReminderCandidate, ReminderRecord } from "./types";

const VALID_KINDS: ReminderKind[] = ["MEDICATION", "APPOINTMENT", "VITALS", "OTHER"];

export function describeSchedule(frequency: ReminderFrequency, nextFireAt: Date): string {
  let h = nextFireAt.getHours();
  const m = nextFireAt.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const time = `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
  if (frequency === "DAILY") return `every day at ${time}`;
  const date = nextFireAt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `on ${date} at ${time}`;
}

export function computeNextFireAt(candidate: ReminderCandidate, now: Date): Date {
  if (candidate.frequency === "ONCE") {
    return new Date(candidate.isoDateTime ?? now);
  }
  const next = new Date(now);
  next.setHours(candidate.hour ?? 8, candidate.minute ?? 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
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
    { model: "gpt-4o-mini", temperature: 0, maxTokens: 200 }
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
