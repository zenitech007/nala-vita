import { cookies } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { redirect } from "next/navigation";
import PatientSidebar from "@/components/layout/PatientSidebar";
import { prisma } from "@/lib/prisma";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { supabaseId: session.user.id },
    select: { firstName: true, lastName: true, avatarUrl: true },
  });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <PatientSidebar user={user} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}