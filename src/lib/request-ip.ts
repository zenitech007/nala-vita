import { isIP } from "node:net";

export function trustedRequestIp(request: Request): string {
  const header = process.env.TRUSTED_CLIENT_IP_HEADER || process.env.OTP_TRUSTED_IP_HEADER;
  if (!header) {
    if (process.env.NODE_ENV !== "production") return "local-development";
    throw new Error("Configure an IP header overwritten by your trusted proxy");
  }
  const value = request.headers.get(header)?.trim();
  if (!value || !isIP(value)) throw new Error("Trusted client IP is unavailable");
  return value;
}
