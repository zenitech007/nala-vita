import { medicationAdherence } from "@/lib/medication-adherence";

const prescription = {
  frequency: "Twice daily", duration: "7 days",
  prescribedAt: new Date("2026-11-10T08:00:00Z"), expiresAt: null, isActive: true,
  usageLogs: ["2026-11-10", "2026-11-11"],
};
const now = new Date("2026-11-11T12:00:00Z");

test("counts scheduled frequency only within the active course", () => {
  expect(medicationAdherence(prescription, now, 7)).toMatchObject({ expectedDoses: 4, rate: 50 });
});

test("excludes PRN, unknown frequency, and inactive courses", () => {
  expect(medicationAdherence({ ...prescription, frequency: "As needed" }, now, 7).status).toBe("not_scheduled");
  expect(medicationAdherence({ ...prescription, frequency: "Occasionally" }, now, 7).rate).toBeNull();
  expect(medicationAdherence({ ...prescription, isActive: false }, now, 7).rate).toBeNull();
});

test("excludes logs outside the course and duplicate daily entries", () => {
  expect(medicationAdherence({
    ...prescription, duration: "1 day",
    usageLogs: ["2026-11-09", "2026-11-10", "2026-11-10", "2026-11-11"],
  }, now, 7)).toMatchObject({ expectedDoses: 2, loggedDoses: 1, rate: 50 });
});

test("does not invent expected doses before a future start or after expiry", () => {
  expect(medicationAdherence({ ...prescription, prescribedAt: new Date("2026-11-15T00:00:00Z") }, now, 7).rate).toBeNull();
  expect(medicationAdherence({ ...prescription, expiresAt: new Date("2026-11-10T23:59:59Z") }, now, 7).expectedDoses).toBe(2);
});
