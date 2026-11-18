const limit = jest.fn(), createUser = jest.fn(), findUser = jest.fn(), getUser = jest.fn(), speech = jest.fn();
jest.mock("@/lib/rate-limit", () => ({ checkRateLimitAsync: (...args: unknown[]) => limit(...args) }));
jest.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { auth: { admin: { createUser } } } }));
jest.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: () => ({ auth: { getUser } }) }));
jest.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (...args: unknown[]) => findUser(...args) } } }));
jest.mock("@/lib/gemini", () => ({ generateSpeech: (...args: unknown[]) => speech(...args) }));
import { POST as register } from "@/app/api/auth/register/route";
import { POST as tts } from "@/app/api/ai/tts/route";

const request = (body: unknown) => new Request("https://example.test/api", {
  method: "POST", body: JSON.stringify(body), headers: { "X-Forwarded-For": "203.0.113.250" },
}) as never;
beforeEach(() => {
  jest.resetAllMocks();
  limit.mockResolvedValue({ allowed: false, resetAt: Date.now() + 1000 });
  createUser.mockResolvedValue({ data: {}, error: { message: "synthetic failure" } });
  getUser.mockResolvedValue({ data: { user: null } });
  speech.mockResolvedValue({ audioBase64: null, mimeType: null });
});
it("F37 registration exhausts its budget before any identity lookup or Auth write", async () => {
  const response = await register(request({
    firstName: "Test", lastName: "Fixture", email: "fixture@example.test", password: "Synthetic123",
    role: "PATIENT", gender: "female", dateOfBirth: "1990-01-01",
  }));
  expect(response.status).toBe(429);
  expect(findUser).not.toHaveBeenCalled();
  expect(createUser).not.toHaveBeenCalled();
});
it("F37 anonymous TTS cannot use a forged forwarded IP or invoke the provider", async () => {
  const response = await tts(request({ text: "Synthetic text" }));
  expect(response.status).toBe(401);
  expect(limit).not.toHaveBeenCalled();
  expect(speech).not.toHaveBeenCalled();
});
