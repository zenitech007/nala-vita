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

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
