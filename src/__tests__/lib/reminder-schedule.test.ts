import { nextDailyFireAt } from "@/lib/reminder-schedule";

test("keeps a daily local time across a daylight-saving offset change", () => {
  expect(nextDailyFireAt(8, 0, "America/New_York", new Date("2026-03-07T14:00:00Z")).toISOString())
    .toBe("2026-03-08T12:00:00.000Z");
});

test("skips a nonexistent spring-forward local time", () => {
  expect(nextDailyFireAt(2, 30, "America/New_York", new Date("2026-03-08T00:00:00Z")).toISOString())
    .toBe("2026-03-09T06:30:00.000Z");
});

test("fires once on a repeated local date", () => {
  expect(nextDailyFireAt(1, 30, "America/New_York", new Date("2026-11-01T05:31:00Z"), "2026-11-01").toISOString())
    .toBe("2026-11-02T06:30:00.000Z");
});

test("supports fractional-hour timezones", () => {
  expect(nextDailyFireAt(8, 0, "Asia/Kathmandu", new Date("2026-03-07T00:00:00Z")).toISOString())
    .toBe("2026-03-07T02:15:00.000Z");
});

test("requires an explicit IANA timezone", () => {
  expect(() => nextDailyFireAt(8, 0, "", new Date())).toThrow();
});
