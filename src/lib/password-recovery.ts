import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const RECOVERY_COOKIE = "nala-recovery-proof";
export function recoveryOrigin(): string {
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "");
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) {
    throw new Error("Configure a trusted application URL.");
  }
  return origin.origin;
}
function secret() {
  const key = process.env.OTP_HASH_SECRET;
  if (!key || key.length < 32) throw new Error("Configure OTP_HASH_SECRET.");
  return key;
}
export function createRecoveryProof(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + 600_000, nonce: randomBytes(16).toString("hex") })).toString("base64url");
  const signature = createHmac("sha256", secret()).update("password-recovery:" + payload).digest("base64url");
  return payload + "." + signature;
}
export function validRecoveryProof(proof: string | undefined, userId: string): boolean {
  if (!proof || proof.length > 1000) return false;
  try {
    const [payload, signature, extra] = proof.split(".");
    if (!payload || !signature || extra) return false;
    const expected = createHmac("sha256", secret()).update("password-recovery:" + payload).digest();
    const received = Buffer.from(signature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.userId === userId && Number.isFinite(data.expiresAt) && data.expiresAt > Date.now() && data.expiresAt <= Date.now() + 600_000;
  } catch {
    return false;
  }
}
