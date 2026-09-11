// src/__tests__/api/ai/tts.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: () => getUser() },
  }),
}));

const generateSpeech = jest.fn();
jest.mock("@/lib/gemini", () => ({
  generateSpeech: (...args: unknown[]) => generateSpeech(...args),
  GEMINI_MODEL: "gemini-2.5-flash",
  GEMINI_TTS_MODEL: "gemini-2.5-flash",
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimitAsync: async () => ({ allowed: true, remaining: 29, resetAt: Date.now() + 60000 }),
}));

import { POST } from "@/app/api/ai/tts/route";

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/ai/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  getUser.mockReset();
  generateSpeech.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("POST /api/ai/tts", () => {
  it("returns audioData when generateSpeech succeeds", async () => {
    generateSpeech.mockResolvedValue({
      audioBase64: "UklGRi...",
      mimeType: "audio/wav",
    });

    const res = await POST(makeReq({ text: "Hello patient" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.audioData).toBe("data:audio/wav;base64,UklGRi...");
    expect(body.fallback).toBe(false);
  });

  it("signals client fallback when server audio generation returns null", async () => {
    generateSpeech.mockResolvedValue({
      audioBase64: null,
      mimeType: null,
    });

    const res = await POST(makeReq({ text: "Take your medication daily" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.fallback).toBe(true);
  });

  it("strips markdown symbols before passing text to generateSpeech", async () => {
    generateSpeech.mockResolvedValue({
      audioBase64: "dGVzdA==",
      mimeType: "audio/mp3",
    });

    await POST(makeReq({ text: "**Bold** _italic_ and `code` with [link](https://example.com)" }));
    expect(generateSpeech).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Bold italic and code with link",
      })
    );
  });
});
