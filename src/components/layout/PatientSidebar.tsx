"use client";

import { SidebarShell, type SidebarUser } from "@/components/layout/SidebarShell";
import { PATIENT_NAV } from "@/lib/nav-config";

interface Props {
  user: SidebarUser | null;
}

export default function PatientSidebar({ user }: Props) {
  return (
    <SidebarShell
      role="patient"
      roleLabel="Patient"
      user={user}
      nav={PATIENT_NAV}
    />
  );
}