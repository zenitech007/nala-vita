const reset = jest.fn();
const update = jest.fn();
const getUser = jest.fn();
const verifyOtp = jest.fn();
const rateLimit = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: () => ({ auth: { resetPasswordForEmail: reset, updateUser: update, getUser, verifyOtp, signOut: jest.fn() } }),
}));
jest.mock("@/lib/request-rate-limit", () => ({ limitByTrustedIp: (...args: unknown[]) => rateLimit(...args) }));
import { POST as requestReset } from "@/app/api/auth/forgot-password/route";
import { POST as updatePassword } from "@/app/api/auth/update-password/route";
import { GET as callback } from "@/app/auth/recovery/route";
import { NextRequest } from "next/server";

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
  process.env.OTP_HASH_SECRET = "synthetic-recovery-secret".repeat(2);
  rateLimit.mockResolvedValue(null);
});
const request = (url: string, body: object) => new NextRequest(url, {
  method: "POST", headers: { "Content-Type": "application/json", origin: "https://app.example.test" }, body: JSON.stringify(body),
});

test("recovery uses the same neutral response for accepted and rejected emails", async () => {
  reset.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "Unknown user" } });
  const responses = await Promise.all(["known@example.test", "unknown@example.test"].map(email => requestReset(request("https://app.example.test/api/auth/forgot-password", { email }))));
  expect(responses.map(response => response.status)).toEqual([202, 202]);
  expect(await responses[0].json()).toEqual(await responses[1].json());
  expect(reset).toHaveBeenCalledWith(expect.any(String), { redirectTo: "https://app.example.test/auth/recovery?type=recovery" });
});

test("throttling prevents a recovery provider request", async () => {
  rateLimit.mockResolvedValue(new Response("limited", { status: 429 }));
  expect((await requestReset(request("https://app.example.test/api/auth/forgot-password", { email: "synthetic@example.test" }))).status).toBe(429);
  expect(reset).not.toHaveBeenCalled();
});

test("an ordinary session cannot submit a recovery password without proof", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const res = await updatePassword(request("https://app.example.test/api/auth/update-password", { password: "synthetic-strong-password" }));
  expect(res.status).toBe(403);
  expect(update).not.toHaveBeenCalled();
});

test("the callback verifies a recovery hash and redirects only to the update screen", async () => {
  verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const res = await callback(new NextRequest("https://app.example.test/auth/recovery?type=recovery&token_hash=synthetic&next=https://attacker.example"));
  expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "synthetic" });
  expect(res.headers.get("location")).toBe("https://app.example.test/update-password");
  expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/i);
});

test("invalid recovery links cannot set a proof", async () => {
  verifyOtp.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
  const res = await callback(new NextRequest("https://app.example.test/auth/recovery?type=recovery&token_hash=expired"));
  expect(res.headers.get("location")).toBe("https://app.example.test/forgot-password?error=expired");
  expect(res.headers.get("set-cookie")).toBeNull();
});

test("a verified recovery proof permits password update and is removed", async () => {
  verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  update.mockResolvedValue({ error: null });
  const confirmed = await callback(new NextRequest("https://app.example.test/auth/recovery?type=recovery&token_hash=synthetic"));
  const proof = confirmed.cookies.get("nala-recovery-proof")!.value;
  const req = request("https://app.example.test/api/auth/update-password", { password: "synthetic-strong-password" });
  req.cookies.set("nala-recovery-proof", proof);
  const response = await updatePassword(req);
  expect(response.status).toBe(200);
  expect(update).toHaveBeenCalledWith({ password: "synthetic-strong-password" });
  expect(response.cookies.get("nala-recovery-proof")?.value).toBe("");
});

test("recovery proof cannot be reused for a different authenticated identity", async () => {
  verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const confirmed = await callback(new NextRequest("https://app.example.test/auth/recovery?type=recovery&token_hash=synthetic"));
  getUser.mockResolvedValue({ data: { user: { id: "u2" } }, error: null });
  const req = request("https://app.example.test/api/auth/update-password", { password: "synthetic-strong-password" });
  req.cookies.set("nala-recovery-proof", confirmed.cookies.get("nala-recovery-proof")!.value);
  expect((await updatePassword(req)).status).toBe(403);
  expect(update).not.toHaveBeenCalled();
});
