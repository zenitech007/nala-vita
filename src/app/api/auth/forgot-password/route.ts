import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { limitByTrustedIp } from "@/lib/request-rate-limit";
import { readBoundedJson } from "@/lib/bounded-body";
import { recoveryOrigin } from "@/lib/password-recovery";

const emailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const MESSAGE = "If an account matches that email, you will receive a password reset link.";

export async function POST(req: NextRequest) {
  const limited = await limitByTrustedIp(req, "password-recovery", { maxRequests: 10, windowMs: 3_600_000 });
  if (limited) return limited;
  try {
    const input = emailSchema.safeParse(await readBoundedJson(req, 4096));
    if (input.success) {
      const supabase = createServerSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(input.data.email, {
        redirectTo: recoveryOrigin() + "/auth/recovery?type=recovery",
      });
      if (error) console.warn(JSON.stringify({ event: "auth.recovery_send_failed" }));
    }
  } catch {
    console.warn(JSON.stringify({ event: "auth.recovery_send_failed" }));
  }
  return NextResponse.json({ message: MESSAGE }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
