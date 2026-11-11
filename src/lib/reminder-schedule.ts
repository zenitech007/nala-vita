import { isIanaTimeZone } from "@/lib/appointment-availability";

function localParts(formatter: Intl.DateTimeFormat, instant: Date) {
  const parts = formatter.formatToParts(instant);
  const value = (type: string) => Number(parts.find(part => part.type === type)!.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

function formatterFor(timeZone: string) {
  if (!isIanaTimeZone(timeZone)) throw new Error("Save a valid IANA timezone in Settings before creating reminders.");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
}

export function reminderLocalDate(instant: Date, timeZone: string): string {
  const p = localParts(formatterFor(timeZone), instant);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).toISOString().slice(0, 10);
}

export function reminderLocalClock(instant: Date, timeZone: string) {
  const { hour, minute } = localParts(formatterFor(timeZone), instant);
  return { hour, minute };
}

/** A missing local time is skipped. A repeated local date is delivered once. */
export function nextDailyFireAt(hour: number, minute: number, timeZone: string, after: Date, deliveredDate?: string): Date {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59
    || !Number.isFinite(after.getTime())) throw new Error("Invalid reminder schedule.");
  const formatter = formatterFor(timeZone);
  const localNow = localParts(formatter, after);
  const firstDay = Date.UTC(localNow.year, localNow.month - 1, localNow.day);
  for (let day = 0; day < 4; day++) {
    const date = new Date(firstDay + day * 86_400_000).toISOString().slice(0, 10);
    if (deliveredDate && date <= deliveredDate) continue;
    const wallClock = firstDay + day * 86_400_000 + hour * 3_600_000 + minute * 60_000;
    const candidates = new Set<number>();
    // Sample both sides of timezone transitions to find every applicable offset.
    for (let sampleDay = -2; sampleDay <= 2; sampleDay++) {
      const sample = new Date(wallClock + sampleDay * 86_400_000);
      const p = localParts(formatter, sample);
      const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - sample.getTime();
      candidates.add(wallClock - offset);
    }
    for (const candidate of [...candidates].sort((a, b) => a - b)) {
      const instant = new Date(candidate);
      const p = localParts(formatter, instant);
      if (instant > after && p.hour === hour && p.minute === minute
        && reminderLocalDate(instant, timeZone) === date) return instant;
    }
  }
  throw new Error("No upcoming occurrence for this timezone.");
}
