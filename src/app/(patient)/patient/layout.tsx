import { redirect } from "next/navigation";
import PatientSidebar from "@/components/layout/PatientSidebar";
import AmeliaLauncher from "@/components/amelia/AmeliaLauncher";
import { getAuthenticatedUserWithProfile } from "@/lib/auth-cache";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const authData = await getAuthenticatedUserWithProfile();
  if (!authData?.session) redirect("/login");

  const { user } = authData;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <PatientSidebar user={user} />
      <div className="flex-1 min-w-0">{children}</div>
      <AmeliaLauncher />
    </div>
  );
}