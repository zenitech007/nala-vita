interface AdherencePrescription {
  frequency: string;
  duration: string;
  prescribedAt: Date | string;
  expiresAt: Date | string | null;
  isActive: boolean;
  usageLogs: string[];
}

const DAY_MS = 86_400_000;
const DAILY_FREQUENCY: Record<string, number> = {
  "once daily": 1, "twice daily": 2, "three times daily": 3, "four times daily": 4,
};

function utcDay(value: Date | string): number {
  const instant = new Date(value);
  return Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate());
}

/** Legacy entries confirm one day each. They cannot establish multiple dose events. */
export function medicationAdherence(prescription: AdherencePrescription, now: Date, windowDays: number) {
  const frequency = prescription.frequency.trim().toLowerCase();
  const excluded = (status: "not_scheduled" | "unavailable") => ({
    status, expectedDoses: 0, loggedDoses: 0, daysTracked: 0,
    rate: null as number | null, logs: [] as string[],
  });
  if (/\bprn\b|as needed|when required/.test(frequency)) return excluded("not_scheduled");
  const dosesPerDay = DAILY_FREQUENCY[frequency];
  // The schema has no stopped-at timestamp for inactive historical prescriptions.
  if (!prescription.isActive || !dosesPerDay) return excluded("unavailable");

  const duration = prescription.duration.trim().toLowerCase();
  const course = duration.match(/^(\d+)\s*(day|week)s?$/);
  const durationDays = course ? Number(course[1]) * (course[2] === "week" ? 7 : 1) : null;
  if ((!durationDays && !/^(ongoing|long[- ]term|indefinite)$/.test(duration) && !prescription.expiresAt)
    || !Number.isFinite(new Date(prescription.prescribedAt).getTime())) return excluded("unavailable");

  const today = utcDay(now);
  const prescribedDay = utcDay(prescription.prescribedAt);
  const start = Math.max(prescribedDay, today - (windowDays - 1) * DAY_MS);
  const end = Math.min(
    today,
    prescription.expiresAt ? utcDay(prescription.expiresAt) : today,
    durationDays ? prescribedDay + (durationDays - 1) * DAY_MS : today,
  );
  const daysTracked = Math.max(0, Math.floor((end - start) / DAY_MS) + 1);
  const logs = [...new Set(prescription.usageLogs.map(value => value.split("T")[0]))].filter(date => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const timestamp = Date.parse(date + "T00:00:00Z");
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
      && timestamp >= start && timestamp <= end;
  }).sort();
  const expectedDoses = daysTracked * dosesPerDay;
  return {
    status: "estimated" as const, expectedDoses, loggedDoses: logs.length, daysTracked, logs,
    rate: expectedDoses ? Math.min(100, Math.round(logs.length / expectedDoses * 100)) : null,
  };
}
