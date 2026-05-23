// Browser-side Supabase client.
//
// IMPORTANT: We use createClientComponentClient from @supabase/auth-helpers-nextjs
// instead of the plain @supabase/supabase-js createClient. The plain client stores
// the session in localStorage. Our middleware (src/middleware.ts) reads the session
// from COOKIES. If those two don't agree, sign-in succeeds on the client but the
// middleware sees no session and bounces every protected route back to /login —
// the user gets stuck in an infinite redirect loop.
//
// createClientComponentClient writes the session to cookies that the SSR helpers
// (createServerClient in middleware, createServerComponentClient in server
// components) can read. Same auth state across browser + server.

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export const supabase = createClientComponentClient();
