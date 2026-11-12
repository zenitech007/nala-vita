import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createRecoveryProof, RECOVERY_COOKIE, recoveryOrigin } from "@/lib/password-recovery";

export async function GET(req: NextRequest) {
  const origin = recoveryOrigin();
  const failed = () => NextResponse.redirect(origin + "/forgot-password?error=expired");
  const type = req.nextUrl.searchParams.get("type");
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const code = req.nextUrl.searchParams.get("code");
  if (type !== "recovery" || (!tokenHash && !code)) return failed();
  try {
    const supabase = createServerSupabaseClient();
    const result = tokenHash
      ? await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash })
      : await supabase.auth.exchangeCodeForSession(code!);
    if (result.error || !result.data.user) return failed();
    const verified = await supabase.auth.getUser();
    if (verified.error || verified.data.user?.id !== result.data.user.id) return failed();
    const response = NextResponse.redirect(origin + "/update-password");
    response.cookies.set(RECOVERY_COOKIE, createRecoveryProof(verified.data.user.id), {
      httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax",
      path: "/api/auth/update-password", maxAge: 600,
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return failed();
  }
}
