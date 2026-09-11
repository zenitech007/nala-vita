import { redirect } from "next/navigation";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { getAuthenticatedUserWithProfile } from "@/lib/auth-cache";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const authData = await getAuthenticatedUserWithProfile();
    if (!authData?.session) redirect("/login");

    const { user } = authData;

    return (
        <div className="flex min-h-screen bg-gray-50">
            <AdminSidebar user={user} />
            <div className="flex-1 min-w-0">{children}</div>
        </div>
    );
}