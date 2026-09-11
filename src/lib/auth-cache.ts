import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

/**
 * Deduplicated session fetcher within a single server request lifecycle.
 */
export const getCachedSession = cache(async () => {
  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
});

/**
 * Deduplicated authenticated user fetcher including patient & doctor profiles.
 * Sharing this between Layout and Page prevents multiple sequential DB round-trips.
 */
export const getAuthenticatedUserWithProfile = cache(async () => {
  const session = await getCachedSession();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { supabaseId: session.user.id },
    include: {
      patient: {
        select: { id: true, dateOfBirth: true, gender: true, bloodType: true },
      },
      doctor: {
        select: { id: true, specialization: true, licenseNumber: true },
      },
    },
  });

  return { session, user };
});
