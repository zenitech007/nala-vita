// ─── Rate Limiter ─────────────────────────────────────────
//
// Strategy:
//   - When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set,
//     uses @upstash/ratelimit (Redis-backed, works across serverless instances).
//   - Otherwise falls back to an in-memory sliding-window limiter
//     (single-process only — suitable for local dev, NOT multi-instance prod).
//
// To enable Redis rate limiting in production:
//   1. Sign up at https://upstash.com
//   2. Create a Redis database
//   3. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to your env
//   4. Run: npm install @upstash/ratelimit @upstash/redis

// ─── Shared result type ───────────────────────────────────

export interface RateLimitResult {
  /** Whether the request should be allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the window resets */
  resetAt: number;
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

// ─── In-memory fallback ───────────────────────────────────

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000; // 1 minute
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(windowMs: number) {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    store.forEach((entry, key) => {
      entry.timestamps = entry.timestamps.filter((t: number) => t > cutoff);
      if (entry.timestamps.length === 0) store.delete(key);
    });
  }, CLEANUP_INTERVAL);
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    (cleanupTimer as NodeJS.Timeout).unref();
  }
}

function inMemoryRateLimit(
  key: string,
  { maxRequests, windowMs }: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  ensureCleanup(windowMs);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    return { allowed: false, remaining: 0, resetAt: oldestInWindow + windowMs };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetAt: now + windowMs,
  };
}

// ─── Upstash Redis limiter (optional) ────────────────────
//
// This block is only executed when both UPSTASH_* env vars are set.
// It dynamically imports @upstash/ratelimit to avoid a hard dependency.

type UpstashLimiter = {
  limit: (key: string) => Promise<{
    success: boolean;
    remaining: number;
    reset: number;
  }>;
};

let upstashLimiterCache: Map<string, UpstashLimiter> | null = null;

async function getUpstashLimiter(
  config: RateLimitConfig
): Promise<UpstashLimiter | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import("@upstash/ratelimit" as string) as Promise<{
        Ratelimit: {
          new (opts: {
            redis: unknown;
            limiter: unknown;
            prefix?: string;
          }): UpstashLimiter;
          slidingWindow: (maxRequests: number, window: string) => unknown;
        };
      }>,
      import("@upstash/redis" as string) as Promise<{
        Redis: { new (opts: { url: string; token: string }): unknown };
      }>,
    ]);

    const redis = new Redis({ url, token });
    const cacheKey = `${config.maxRequests}:${config.windowMs}`;

    if (!upstashLimiterCache) upstashLimiterCache = new Map();
    if (!upstashLimiterCache.has(cacheKey)) {
      const windowSeconds = Math.ceil(config.windowMs / 1000);
      upstashLimiterCache.set(
        cacheKey,
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(
            config.maxRequests,
            `${windowSeconds}s`
          ),
          prefix: "mediconnect:rl",
        })
      );
    }

    return upstashLimiterCache.get(cacheKey)!;
  } catch {
    // @upstash/ratelimit not installed — fall through to in-memory
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────

/**
 * Synchronous in-memory rate limit check.
 * Default: 10 requests per 60 seconds.
 *
 * ⚠️  For multi-instance / serverless deployments, set UPSTASH_REDIS_REST_URL
 *    and UPSTASH_REDIS_REST_TOKEN and use `checkRateLimitAsync` instead.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60_000 }
): RateLimitResult {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    // Remind callers to use the async version when Redis is configured
    console.warn(
      `[rate-limit] UPSTASH_REDIS_REST_URL is set but checkRateLimit() ` +
      `was called synchronously for key "${key}". ` +
      `Switch to checkRateLimitAsync() for distributed rate limiting.`
    );
  }
  return inMemoryRateLimit(key, config);
}

/**
 * Async rate limit check.
 * Uses Upstash Redis when env vars are set, falls back to in-memory.
 * Prefer this over checkRateLimit() in all API routes.
 */
export async function checkRateLimitAsync(
  key: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60_000 }
): Promise<RateLimitResult> {
  const upstash = await getUpstashLimiter(config);

  if (upstash) {
    const result = await upstash.limit(key);
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  }

  return inMemoryRateLimit(key, config);
}
