export interface DoctorAvailability {
  isVerified: boolean;
  user: { isActive: boolean };
  timeZone: string | null;
  availableDays: string[];
  availableFrom: string | null;
  availableTo: string | null;
}

export function isIanaTimeZone(value: string): boolean {
  // Reject fixed offsets: the schedule needs daylight-saving-aware zone rules.
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$/.test(value) && value !== "UTC") return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; }
  catch { return false; }
}

/** Checks each elapsed minute in local time, including DST and date boundaries. */
export function appointmentAvailabilityError(
  doctor: DoctorAvailability, start: Date, duration: number, now = new Date()
): string | null {
  if (!doctor.isVerified || !doctor.user.isActive) return "Doctor is not available for booking";
  if (!Number.isFinite(start.getTime()) || start <= now || !Number.isInteger(duration) || duration < 15 || duration > 120)
    return "Choose a future appointment with an integer duration between 15 and 120 minutes";
  if (start.getUTCSeconds() || start.getUTCMilliseconds()) return "Appointments must start on a whole minute";
  if (!doctor.timeZone || !isIanaTimeZone(doctor.timeZone)) return "Doctor must configure an IANA timezone before booking";
  if (!doctor.availableFrom || !doctor.availableTo || !/^([01]\d|2[0-3]):[0-5]\d$/.test(doctor.availableFrom)
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(doctor.availableTo)) return "Doctor availability has not been configured";
  const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
  const from = minutes(doctor.availableFrom), to = minutes(doctor.availableTo);
  if (from >= to || !doctor.availableDays.length) return "Doctor availability has not been configured";
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: doctor.timeZone, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let offset = 0; offset < duration; offset++) {
    const parts = formatter.formatToParts(new Date(start.getTime() + offset * 60_000));
    const get = (type: string) => parts.find(part => part.type === type)!.value;
    const minute = Number(get("hour")) * 60 + Number(get("minute"));
    const day = get("weekday").toLowerCase();
    if (!doctor.availableDays.some(value => value.toLowerCase() === day || value.toLowerCase() === day.slice(0, 3))
      || minute < from || minute >= to) return "The full appointment must fit within the doctor's availability";
  }
  return null;
}
