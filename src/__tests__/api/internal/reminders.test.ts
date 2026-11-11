const worker = jest.fn();
jest.mock("@/lib/reminder-worker", () => ({ runReminderWorker: () => worker() }));
import { GET } from "@/app/api/internal/reminders/route";
import { NextRequest } from "next/server";

const previousSecret = process.env.CRON_SECRET;
afterEach(() => {
  jest.clearAllMocks();
  if (previousSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousSecret;
});

test("rejects an unconfigured worker", async () => {
  delete process.env.CRON_SECRET;
  expect((await GET(new NextRequest("http://localhost/api/internal/reminders"))).status).toBe(503);
  expect(worker).not.toHaveBeenCalled();
});

test("rejects a caller without the cron secret", async () => {
  process.env.CRON_SECRET = "synthetic".repeat(8);
  expect((await GET(new NextRequest("http://localhost/api/internal/reminders"))).status).toBe(401);
  expect(worker).not.toHaveBeenCalled();
});

test("runs the bounded worker for the configured scheduler", async () => {
  process.env.CRON_SECRET = "synthetic".repeat(8);
  worker.mockResolvedValue(2);
  const res = await GET(new NextRequest("http://localhost/api/internal/reminders", {
    headers: { authorization: "Bearer " + process.env.CRON_SECRET },
  }));
  expect(await res.json()).toEqual({ delivered: 2 });
});
