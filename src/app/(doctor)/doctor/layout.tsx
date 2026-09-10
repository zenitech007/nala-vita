import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import DoctorSidebar from "@/components/layout/DoctorSidebar";
import AmeliaLauncher from "@/components/amelia/AmeliaLauncher";
import { prisma } from "@/lib/prisma";

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
    const supabase = createServerSupabaseClient();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect("/login");

    const user = await prisma.user.findUnique({
        where: { supabaseId: session.user.id },
        select: { firstName: true, lastName: true, avatarUrl: true },
    });

    return (
        <div className="flex min-h-screen bg-gray-50">
            <DoctorSidebar user={user} />
            <div className="flex-1 min-w-0">{children}</div>
            <AmeliaLauncher role="doctor" />
        </div>
    );
}