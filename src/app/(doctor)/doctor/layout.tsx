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
    if (!user.doctor!.isVerified) {
      const rejected = user.doctor!.verification?.status === "REJECTED";
      return <main className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-semibold">{rejected ? "Verification rejected" : "Verification pending"}</h1>
        <p className="mt-3 text-gray-700">Your clinician account requires an administrator review before clinical tools become available.</p>
        {user.doctor!.verification?.reason && <p className="mt-3 text-gray-700">{user.doctor!.verification.reason}</p>}
        <p className="mt-3 text-gray-600">Contact your clinic administrator about the review.</p>
        <a href="/login" className="mt-5 inline-block underline">Return to sign in</a>
      </main>;
    }


    return (
        <div className="flex min-h-screen bg-gray-50">
            <DoctorSidebar user={user} />
            <div className="flex-1 min-w-0">{children}</div>
        </div>
    );
}