"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Calendar,
    Users,
    Video,
    FileText,
    FlaskConical,
    Activity,
    Share2,
    CreditCard,
    BarChart3,
    Settings
} from "lucide-react";

const navItems = [
    { name: "Dashboard", href: "/doctor/dashboard", icon: LayoutDashboard },
    { name: "Appointments", href: "/doctor/appointments", icon: Calendar },
    { name: "My Patients", href: "/doctor/patients", icon: Users },
    { name: "Consultations", href: "/doctor/consultations", icon: Video },
    { name: "Prescriptions", href: "/doctor/prescriptions", icon: FileText },
    { name: "Lab Orders", href: "/doctor/lab-orders", icon: FlaskConical },
    { name: "Patient Monitoring", href: "/doctor/monitoring", icon: Activity },
    { name: "Referrals", href: "/doctor/referrals", icon: Share2 },
    { name: "Billing", href: "/doctor/billing", icon: CreditCard },
    { name: "Analytics", href: "/doctor/analytics", icon: BarChart3 },
    { name: "Settings", href: "/doctor/settings", icon: Settings },
];

export default function DoctorSidebar({ user }: { user: any }) {
    const pathname = usePathname();

    return (
        <div className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
            <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">Doctor Panel</h2>
                {user && (
                    <p className="text-sm text-gray-500 mt-1">Dr. {user.lastName}</p>
                )}
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? "bg-blue-50 text-blue-700"
                                    : "text-gray-700 hover:bg-gray-100"
                                }`}
                        >
                            <Icon className="w-5 h-5" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}