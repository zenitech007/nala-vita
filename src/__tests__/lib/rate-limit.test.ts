/**
 * Unit tests for the rate-limit utility.
 *
 * These tests cover the in-memory sliding-window limiter (no Redis required).
 */

import { checkRateLimitAsync } from "@/lib/rate-limit";

// Ensure Upstash env vars are NOT set so we test the in-memory path
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

describe("checkRateLimitAsync — in-memory", () => {
  it("allows requests within the limit", async () => {
    const key = `test:allow:${Date.now()}`;
    const config = { maxRequests: 5, windowMs: 60_000 };

    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimitAsync(key, config);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests exceeding the limit", async () => {
    const key = `test:block:${Date.now()}`;
    const config = { maxRequests: 3, windowMs: 60_000 };

    // Exhaust the limit
    for (let i = 0; i < 3; i++) {
      await checkRateLimitAsync(key, config);
    }

    const blocked = await checkRateLimitAsync(key, config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBeGreaterThan(Date.now());
  });

  it("returns correct remaining count", async () => {
    const key = `test:remaining:${Date.now()}`;
    const config = { maxRequests: 5, windowMs: 60_000 };

    const first = await checkRateLimitAsync(key, config);
    expect(first.remaining).toBe(4);

    const second = await checkRateLimitAsync(key, config);
    expect(second.remaining).toBe(3);
  });

  it("resets after the window expires", async () => {
    const key = `test:reset:${Date.now()}`;
    const config = { maxRequests: 1, windowMs: 100 }; // 100ms window

    const first = await checkRateLimitAsync(key, config);
    expect(first.allowed).toBe(true);

    const blocked = await checkRateLimitAsync(key, config);
    expect(blocked.allowed).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 150));

    const afterReset = await checkRateLimitAsync(key, config);
    expect(afterReset.allowed).toBe(true);
  });
});
