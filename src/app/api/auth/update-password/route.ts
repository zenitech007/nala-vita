import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { limitByTrustedIp } from "@/lib/request-rate-limit";
import { readBoundedJson } from "@/lib/bounded-body";
import { RECOVERY_COOKIE, recoveryOrigin, validRecoveryProof } from "@/lib/password-recovery";

const schema = z.object({ password: z.string().min(8).max(128) });

export async function POST(req: NextRequest) {
  const limited = await limitByTrustedIp(req, "password-update", { maxRequests: 10, windowMs: 3_600_000 });
  if (limited) return limited;
  if (req.headers.get("origin") !== recoveryOrigin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = createServerSupabaseClient();
  const verified = await supabase.auth.getUser();
  if (verified.error || !verified.data.user || !validRecoveryProof(req.cookies.get(RECOVERY_COOKIE)?.value, verified.data.user.id)) {
    return NextResponse.json({ error: "This reset link is invalid or expired. Request another link." }, { status: 403 });
  }
  try {
    const input = schema.safeParse(await readBoundedJson(req, 4096));
    if (!input.success) return NextResponse.json({ error: "Choose a password between 8 and 128 characters." }, { status: 422 });
    const { error } = await supabase.auth.updateUser({ password: input.data.password });
    if (error) return NextResponse.json({ error: "Could not update the password. Please retry." }, { status: 502 });
    await supabase.auth.signOut({ scope: "global" });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(RECOVERY_COOKIE, "", { path: "/api/auth/update-password", maxAge: 0, httpOnly: true, sameSite: "lax", secure: recoveryOrigin().startsWith("https:") });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json({ error: "Could not update the password. Please retry." }, { status: 502 });
  }
}
