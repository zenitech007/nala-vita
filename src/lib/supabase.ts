// Browser-side Supabase client.
//
// IMPORTANT: We use createBrowserClient from @supabase/auth-helpers-nextjs
// (which in v0.15 actually re-exports the @supabase/ssr API) instead of the
// plain @supabase/supabase-js createClient. The plain client stores the
// session in localStorage. Our middleware (src/middleware.ts) reads the
// session from COOKIES via createServerClient from the same package. If
// the two don't agree, sign-in succeeds on the client but the middleware
// sees no session and bounces every protected route back to /login — the
// user gets stuck in an infinite redirect loop.
//
// createBrowserClient writes the session to cookies that BOTH the browser
// client AND the SSR helpers (createServerClient in middleware,
// createServerComponentClient in server components) can read. Single
// source of truth for auth state across browser + server + middleware.

import { createBrowserClient } from "@supabase/auth-helpers-nextjs";

// ─────────────────────────────────────────────────────────────
// In-process lock to replace Supabase's default navigator.locks
// ─────────────────────────────────────────────────────────────
// Supabase's auth client uses navigator.locks by default to coordinate
// auth calls across tabs and against the internal auto-refresh timer.
// In practice this throws:
//
//   Error: Lock "lock:sb-<ref>-auth-token" was released because another
//   request stole it
//
// …whenever two auth calls overlap. The common triggers in our app:
//   • React Strict Mode dev double-invokes useEffect → two getSession()
//     or getUser() calls in flight at once
//   • Multiple client components on the same page each call getUser()
//   • Supabase's background auto-refresh timer races with an in-flight
//     manual getSession()
//
// Replacing the lock with a process-local promise chain serialises
// concurrent in-tab calls (no race) without using the navigator.locks
// API at all (no "stolen" semantics).
//
// Trade-off: no cross-tab coordination. If a user has two Nala Vita
// tabs open and both refresh the token simultaneously, both succeed and
// one's result is overwritten by the other — harmless, no data loss,
// just one redundant network call. This is acceptable for a single-SPA
// healthcare app; the lock-stolen errors were not.
let chain: Promise<unknown> = Promise.resolve();
const processLock = async <R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => {
  const next = chain.then(() => fn());
  // keep the chain alive even if fn() rejects, so a thrown error in
  // one call doesn't permanently break all subsequent auth calls
  chain = next.catch(() => undefined);
  return next;
};

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseUrl = rawUrl && rawUrl.startsWith("http") ? rawUrl : "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key";

export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      lock: processLock,
    },
  }
);
