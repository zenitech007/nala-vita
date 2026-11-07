import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { trustedRequestIp } from "@/lib/request-ip";
import { checkRateLimitAsync, type RateLimitConfig, type RateLimitResult } from "@/lib/rate-limit";

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json({ error: "Too many requests. Please try again later." }, {
    status: 429,
    headers: { "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))) },
  });
}

export async function limitByTrustedIp(request: Request, scope: string, config: RateLimitConfig) {
  let ip: string;
  try {
    ip = trustedRequestIp(request);
  } catch {
    console.warn(JSON.stringify({ event: "rate_limit.trusted_ip_unavailable", scope }));
    return NextResponse.json({ error: "Request protection is temporarily unavailable" }, { status: 503 });
  }
  const key = createHash("sha256").update(ip).digest("hex");
  const result = await checkRateLimitAsync(`${scope}:ip:${key}`, config);
  return result.allowed ? null : rateLimitResponse(result);
}
