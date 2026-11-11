import type { Metadata } from "next";
import { redirect } from "next/navigation";
import DoctorSidebar from "@/components/layout/DoctorSidebar";
import { getAuthenticatedUserWithProfile } from "@/lib/auth-cache";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
    const authData = await getAuthenticatedUserWithProfile();
    if (!authData?.session || !authData.user?.isActive) redirect("/login");
  if (authData.user.role !== "DOCTOR" || !authData.user.doctor) redirect("/unauthorized");

    const { user } = authData;

    return (
        <div className="flex min-h-screen bg-gray-50">
            <DoctorSidebar user={user} />
            <div className="flex-1 min-w-0">{children}</div>
        </div>
    );
}