"use client";

import { SidebarShell, type SidebarUser } from "@/components/layout/SidebarShell";
import { ADMIN_NAV } from "@/lib/nav-config";

interface Props {
  user: SidebarUser | null;
}

export default function AdminSidebar({ user }: Props) {
  return (
    <SidebarShell
      role="admin"
      roleLabel="Admin"
      user={user}
      nav={ADMIN_NAV}
    />
  );
}