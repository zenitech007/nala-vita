import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export function createServerSupabaseClient() {
  const cookieStorePromise = cookies();
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseUrl = rawUrl && rawUrl.startsWith("http") ? rawUrl : "https://placeholder.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key";

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        async getAll() {
          const cookieStore = await cookieStorePromise;
          return cookieStore.getAll();
        },
        async setAll(cookiesToSet) {
          try {
            const cookieStore = await cookieStorePromise;
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can be called from a Server Component where setting
            // cookies is not possible. This can be safely ignored when
            // the middleware refreshes the session.
          }
        },
      },
    }
  );
}
