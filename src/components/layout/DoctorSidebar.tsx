"use client";

import { SidebarShell, type SidebarUser } from "@/components/layout/SidebarShell";
import { DOCTOR_NAV } from "@/lib/nav-config";

interface Props {
  user: SidebarUser | null;
}

export default function DoctorSidebar({ user }: Props) {
  return (
    <SidebarShell
      role="doctor"
      roleLabel="Doctor"
      user={user}
      nav={DOCTOR_NAV}
    />
  );
}