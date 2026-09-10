import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export type AppRole = "PATIENT" | "DOCTOR" | "ADMIN";
export type RequiredProfile = "patient" | "doctor" | "admin";

const AUTH_USER_INCLUDE = {
  patient: true,
  doctor: true,
  admin: true,
} satisfies Prisma.UserInclude;

export type AuthenticatedUser = Prisma.UserGetPayload<{
  include: typeof AUTH_USER_INCLUDE;
}>;

export type ApiAuthResult =
  | { ok: true; user: AuthenticatedUser; authUserId: string }
  | { ok: false; response: NextResponse };

interface RequireApiUserOptions {
  roles?: readonly AppRole[];
  profile?: RequiredProfile;
  /** Only verification/status endpoints should opt out. */
  allowUnverifiedDoctor?: boolean;
}

function errorResponse(status: number, error: string): ApiAuthResult {
  return {
    ok: false,
    response: NextResponse.json({ error }, { status }),
  };
}

/**
 * Resolve the signed-in Supabase identity to the authoritative Prisma user.
 * Supabase metadata is intentionally not used for authorization decisions.
 */
export async function getCurrentUser(): Promise<{
  user: AuthenticatedUser;
  authUserId: string;
} | null> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) return null;

  const user = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    include: AUTH_USER_INCLUDE,
  });

  return user ? { user, authUserId: authUser.id } : null;
}

/**
 * API authorization guard. It validates the session with Supabase, then uses
 * the database as the source of truth for role, activation and verification.
 */
export async function requireApiUser(
  options: RequireApiUserOptions = {}
): Promise<ApiAuthResult> {
  const current = await getCurrentUser();
  if (!current) return errorResponse(401, "Unauthorized");

  const { user, authUserId } = current;

  if (!user.isActive) {
    return errorResponse(403, "This account has been deactivated");
  }

  if (options.roles && !options.roles.includes(user.role as AppRole)) {
    return errorResponse(403, "Forbidden");
  }

  if (
    user.role === "DOCTOR" &&
    !options.allowUnverifiedDoctor &&
    (!user.doctor || !user.doctor.isVerified)
  ) {
    return errorResponse(403, "Doctor account is pending verification");
  }

  if (options.profile && !user[options.profile]) {
    return errorResponse(403, `Required ${options.profile} profile not found`);
  }

  return { ok: true, user, authUserId };
}

