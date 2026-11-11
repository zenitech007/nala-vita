import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runReminderWorker } from "@/lib/reminder-worker";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "Reminder worker is not configured." }, { status: 503 });
  }
  const received = req.headers.get("authorization") ?? "";
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(received), hash(`Bearer ${secret}`))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ delivered: await runReminderWorker() });
  } catch {
    console.error(JSON.stringify({ event: "reminder.worker_failed" }));
    return NextResponse.json({ error: "Reminder delivery failed. Retry the worker." }, { status: 503 });
  }
}
