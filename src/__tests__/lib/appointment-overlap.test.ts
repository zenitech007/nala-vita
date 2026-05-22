/**
 * Integration-style tests for the appointment overlap detection logic.
 *
 * We test the JS overlap calculation in isolation (no DB required).
 */

/**
 * Replicates the exact overlap check from /api/appointments/route.ts
 * so we can unit-test the logic independently.
 */
function checkOverlap(
  existingStart: Date,
  existingDurationMinutes: number,
  newStart: Date,
  newDurationMinutes: number
): boolean {
  const existingEnd = existingStart.getTime() + existingDurationMinutes * 60_000;
  const newEnd = newStart.getTime() + newDurationMinutes * 60_000;
  return existingStart.getTime() < newEnd && existingEnd > newStart.getTime();
}

const base = new Date("2026-06-01T10:00:00Z");
const mins = (n: number) => new Date(base.getTime() + n * 60_000);

describe("Appointment overlap detection", () => {
  it("detects exact same start time as conflict", () => {
    expect(checkOverlap(base, 30, base, 30)).toBe(true);
  });

  it("detects partial overlap (new starts during existing)", () => {
    // Existing: 10:00 – 10:30, New: 10:15 – 10:45
    expect(checkOverlap(base, 30, mins(15), 30)).toBe(true);
  });

  it("detects partial overlap (existing starts during new)", () => {
    // Existing: 10:15 – 10:45, New: 10:00 – 10:30
    expect(checkOverlap(mins(15), 30, base, 30)).toBe(true);
  });

  it("detects contained slot as conflict", () => {
    // Existing: 10:00 – 11:00 (60 min), New: 10:20 – 10:40 (20 min)
    expect(checkOverlap(base, 60, mins(20), 20)).toBe(true);
  });

  it("allows back-to-back slots (no gap)", () => {
    // Existing: 10:00 – 10:30, New: 10:30 – 11:00 — should NOT conflict
    expect(checkOverlap(base, 30, mins(30), 30)).toBe(false);
  });

  it("allows slot before existing appointment", () => {
    // Existing: 11:00 – 11:30, New: 10:00 – 10:30
    expect(checkOverlap(mins(60), 30, base, 30)).toBe(false);
  });

  it("allows slot after existing appointment", () => {
    // Existing: 10:00 – 10:30, New: 11:00 – 11:30
    expect(checkOverlap(base, 30, mins(60), 30)).toBe(false);
  });

  it("handles 1-minute gap between slots as non-conflicting", () => {
    // Existing: 10:00 – 10:30, New: 10:31 – 11:01
    expect(checkOverlap(base, 30, mins(31), 30)).toBe(false);
  });
});
