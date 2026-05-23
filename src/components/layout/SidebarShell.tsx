"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, LogOut, X, Heart, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav-config";

export type SidebarRole = "patient" | "doctor" | "admin";

export interface SidebarUser {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

interface Props {
  role: SidebarRole;
  roleLabel: string;
  brand?: string;
  user: SidebarUser | null;
  nav: readonly NavItem[];
}

const COLLAPSED_W = "w-[72px]";
const EXPANDED_W = "w-72";
const STORAGE_KEY = (role: SidebarRole) => `sidebar-collapsed-${role}`;

export function SidebarShell({ role, roleLabel, brand = "Nala Vita", user, nav }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY(role));
    if (stored !== null) setIsCollapsed(stored === "true");
  }, [role]);

  const toggleCollapse = () => {
    setIsCollapsed((v) => {
      const next = !v;
      localStorage.setItem(STORAGE_KEY(role), String(next));
      return next;
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const settingsHref = `/${role}/settings`;

  function NavLink({ item }: { item: NavItem }) {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        title={isCollapsed ? item.label : undefined}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex items-center px-3 py-3 rounded-xl transition-colors text-sm",
          isCollapsed ? "justify-center" : "gap-3",
          isActive
            ? "bg-[var(--primary)]/10 text-[var(--primary)] font-semibold"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/50 font-medium"
        )}
      >
        <Icon size={20} className="shrink-0" />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-30 p-2.5 bg-white dark:bg-[#1E1F22] border border-gray-200 dark:border-gray-800 rounded-full shadow-sm text-gray-600 dark:text-gray-300"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen sticky top-0 shrink-0",
          "bg-[#f9f9f9] dark:bg-[#1E1F22] border-r border-gray-200 dark:border-gray-800",
          "transition-all duration-300 ease-in-out",
          isCollapsed ? COLLAPSED_W : EXPANDED_W
        )}
      >
        <div className={cn("h-16 flex items-center shrink-0", isCollapsed ? "justify-center" : "px-4 justify-between")}>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-[var(--primary)]" />
              <span className="font-bold text-gray-900 dark:text-white">{brand}</span>
            </div>
          )}
          <button
            onClick={toggleCollapse}
            aria-label="Toggle sidebar"
            className="p-2.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <Menu size={20} />
          </button>
        </div>

        {user && !isCollapsed && (
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 mx-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] font-semibold text-sm">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500">{roleLabel}</p>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        <div className="p-3 space-y-1 shrink-0 border-t border-gray-200 dark:border-gray-800">
          <Link
            href={settingsHref}
            title={isCollapsed ? "Settings" : undefined}
            className={cn(
              "flex items-center px-3 py-3 rounded-xl transition-colors text-sm font-medium",
              isCollapsed ? "justify-center" : "gap-3",
              pathname.startsWith(settingsHref)
                ? "bg-[var(--primary)]/10 text-[var(--primary)] font-semibold"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/50"
            )}
          >
            <SettingsIcon size={20} className="shrink-0" />
            {!isCollapsed && <span>Settings</span>}
          </Link>
          <button
            onClick={handleSignOut}
            aria-label="Sign Out"
            className={cn(
              "flex items-center w-full px-3 py-3 rounded-xl transition-colors text-sm font-medium",
              isCollapsed ? "justify-center" : "gap-3",
              "text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
            )}
          >
            <LogOut size={20} className="shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-[#f9f9f9] dark:bg-[#1E1F22] shadow-2xl z-50 flex flex-col lg:hidden border-r border-gray-200 dark:border-gray-800"
            >
              <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-[var(--primary)]" />
                  <span className="font-bold text-gray-900 dark:text-white">{brand}</span>
                </div>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  aria-label="Close menu"
                  className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full text-gray-500"
                >
                  <X size={18} />
                </button>
              </div>
              {user && (
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] font-semibold text-sm">
                      {user.firstName[0]}{user.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{roleLabel}</p>
                    </div>
                  </div>
                </div>
              )}
              <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    aria-current={pathname === item.href || pathname.startsWith(item.href + "/") ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-sm",
                      pathname === item.href || pathname.startsWith(item.href + "/")
                        ? "bg-[var(--primary)]/10 text-[var(--primary)] font-semibold"
                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/50 font-medium"
                    )}
                  >
                    <item.icon size={20} className="shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
              <div className="p-3 space-y-1 border-t border-gray-200 dark:border-gray-800">
                <Link
                  href={settingsHref}
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/50"
                >
                  <SettingsIcon size={20} />
                  <span>Settings</span>
                </Link>
                <button
                  onClick={() => { setIsMobileOpen(false); handleSignOut(); }}
                  aria-label="Sign Out"
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <LogOut size={20} />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
