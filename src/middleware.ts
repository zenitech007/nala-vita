import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";

// ─── Role-based route prefixes ───────────────────────────

const ROLE_ROUTES: Record<string, string> = {
  "/patient": "PATIENT",
  "/doctor": "DOCTOR",
  "/admin": "ADMIN",
};

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Create Supabase client for middleware with getAll/setAll
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll().map(({ name, value }) => ({
            name,
            value,
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set({ name, value, ...options });
            res.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  // Refresh the session (important for auth-helpers to keep session alive)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;

  // If no authenticated user, redirect to login
  if (!user) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Extract role from user_metadata
  const role = (user.user_metadata?.role as string)?.toUpperCase() ?? "";

  // Check if the route requires a specific role
  for (const [prefix, requiredRole] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(prefix)) {
      if (role !== requiredRole) {
        const unauthorizedUrl = req.nextUrl.clone();
        unauthorizedUrl.pathname = "/unauthorized";
        return NextResponse.redirect(unauthorizedUrl);
      }
      break;
    }
  }

  return res;
}

// ─── Matcher config ──────────────────────────────────────

export const config = {
  matcher: ["/patient/:path*", "/doctor/:path*", "/admin/:path*"],
};
