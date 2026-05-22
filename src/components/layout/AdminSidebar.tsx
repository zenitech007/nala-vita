"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    Bed,
    FileText,
    Settings,
    LogOut,
    Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Staff", href: "/admin/staff", icon: Users },
    { label: "Beds & Resources", href: "/admin/resources", icon: Bed },
    { label: "Reports", href: "/admin/reports", icon: FileText },
    { label: "Settings", href: "/admin/settings", icon: Settings },
];

interface Props {
    user: { firstName: string; lastName: string; avatarUrl: string | null } | null;
}

export default function AdminSidebar({ user }: Props) {
    const pathname = usePathname();
    const router = useRouter();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    return (
        <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col sticky top-0 h-screen overflow-y-auto">
            {/* Brand */}
            <div className="p-6 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <Heart className="w-6 h-6 text-blue-600" />
                    <span className="font-bold text-gray-900">Nala Vita</span>
                </div>
            </div>

            {/* User */}
            {user && (
                <div className="px-4 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                            {user.firstName[0]}
                            {user.lastName[0]}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900">
                                {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-gray-500">Admin</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Nav */}
            <nav className="flex-1 p-3 space-y-0.5">
                {NAV_ITEMS.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition",
                                active
                                    ? "bg-blue-50 text-blue-700"
                                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            )}
                        >
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Sign out */}
            <div className="p-3 border-t border-gray-100">
                <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition w-full"
                >
                    <LogOut className="w-4 h-4" />
                    Sign out
                </button>
            </div>
        </aside>
    );
}