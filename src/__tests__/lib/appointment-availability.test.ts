import { appointmentAvailabilityError, isIanaTimeZone } from '@/lib/appointment-availability';
const doctor = { isVerified: true, user: { isActive: true }, timeZone: 'America/New_York',
  availableDays: ['Sunday'], availableFrom: '01:00', availableTo: '03:00' };
it('F13 validates IANA zones without guessing offsets', () => {
  expect(isIanaTimeZone('America/Phoenix')).toBe(true);
  expect(isIanaTimeZone('+07:00')).toBe(false);
  expect(isIanaTimeZone('Invalid/Zone')).toBe(false);
});
it('F13 checks the entire slot across spring DST jump', () => {
  // 01:45 EST + 30 elapsed minutes ends at 03:15 EDT, outside hours.
  expect(appointmentAvailabilityError(doctor, new Date('2030-03-10T06:45:00Z'), 30, new Date('2030-01-01'))).not.toBeNull();
});
it('F13 allows the exact closing boundary and rejects one minute beyond it', () => {
  const schedule = { ...doctor, timeZone: 'America/Phoenix', availableDays: ['Monday'], availableTo: '17:00' };
  expect(appointmentAvailabilityError(schedule, new Date('2030-01-07T23:30:00Z'), 30, new Date('2030-01-01'))).toBeNull();
  expect(appointmentAvailabilityError(schedule, new Date('2030-01-07T23:31:00Z'), 30, new Date('2030-01-01'))).not.toBeNull();
});
