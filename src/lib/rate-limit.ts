// ─── In-memory sliding window rate limiter ───────────────
//
// Tracks request timestamps per key (userId). Each call to
// `checkRateLimit` prunes expired entries and checks whether
// the caller has exceeded `maxRequests` within `windowMs`.
//
// This is intentionally simple — suitable for a single-process
// Next.js server. For multi-instance deployments, replace with
// a Redis-backed limiter (e.g. @upstash/ratelimit).

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup to prevent memory leaks from abandoned keys
const CLEANUP_INTERVAL = 60_000; // 1 minute
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(windowMs: number) {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    const keys = Array.from(store.keys());
    for (const key of keys) {
      const entry = store.get(key)!;
      entry.timestamps = entry.timestamps.filter((t: number) => t > cutoff);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
  // Allow Node to exit even if the timer is still active
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  /** Whether the request should be allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the window resets */
  resetAt: number;
}

/**
 * Check whether a given key (typically userId) is within rate limits.
 *
 * Default: 10 requests per 60 seconds.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60_000 }
): RateLimitResult {
  const { maxRequests, windowMs } = config;
  const now = Date.now();
  const windowStart = now - windowMs;

  ensureCleanup(windowMs);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Prune timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= maxRequests) {
    // Rate limited — find when the earliest entry in the window expires
    const oldestInWindow = entry.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldestInWindow + windowMs,
    };
  }

  // Allow and record
  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetAt: now + windowMs,
  };
}
