import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const response = NextResponse.next();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(cookies) { for (const { name, value, options } of cookies) {
        req.cookies.set({ name, value, ...options }); response.cookies.set({ name, value, ...options });
      } },
    },
  });
  // Verify identity here. Database-backed role/status checks also run in layouts
  // and APIs; editable JWT metadata never authorizes access.
  let authenticated = false;
  try { const { data, error } = await supabase.auth.getUser(); authenticated = !error && !!data.user; } catch { authenticated = false; }
  if (authenticated) return response;
  const login = req.nextUrl.clone(); login.pathname = "/login";
  login.searchParams.set("redirectTo", req.nextUrl.pathname);
  const redirect = NextResponse.redirect(login);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
export const config = { matcher: ["/patient/:path*", "/doctor/:path*", "/admin/:path*"] };
