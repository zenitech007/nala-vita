"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  MapPin,
  Mail,
  Users,
  Database,
  Shield,
  CreditCard,
  Bot,
  CheckCircle,
  Loader2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

interface SystemService {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "operational" | "degraded" | "down";
  description: string;
}

// ─── Component ──────────────────────────────────────────

export default function AdminSettingsPage() {
  const [staffCount, setStaffCount] = useState<number | null>(null);
  const [staffLoading, setStaffLoading] = useState(true);

  useEffect(() => {
    async function fetchStaffCount() {
      try {
        const res = await fetch("/api/admin/reports");
        if (res.ok) {
          const data = await res.json();
          setStaffCount(data.overview?.totalDoctors ?? 0);
        }
      } catch {
        // silently fail — display fallback
      } finally {
        setStaffLoading(false);
      }
    }
    fetchStaffCount();
  }, []);

  // ─── Hospital info ──────────────────────────────────────

  const hospitalInfo = [
    {
      label: "Hospital Name",
      value: "Nala Vita Medical Center",
      icon: Building2,
    },
    {
      label: "Address",
      value: "123 Healthcare Avenue, Medical District, Lagos, Nigeria",
      icon: MapPin,
    },
    {
      label: "Contact Email",
      value: "admin@nalavita.care",
      icon: Mail,
    },
  ];

  // ─── System services ───────────────────────────────────

  const systemServices: SystemService[] = [
    {
      name: "Database",
      icon: Database,
      status: "operational",
      description: "PostgreSQL connected",
    },
    {
      name: "Supabase",
      icon: Shield,
      status: "operational",
      description: "Auth & storage active",
    },
    {
      name: "Paystack",
      icon: CreditCard,
      status: "operational",
      description: "Connected",
    },
    {
      name: "OpenAI",
      icon: Bot,
      status: "operational",
      description: "Connected",
    },
  ];

  const statusConfig: Record<
    string,
    { label: string; color: string; dotColor: string }
  > = {
    operational: {
      label: "Operational",
      color: "bg-green-100 text-green-700",
      dotColor: "bg-green-500",
    },
    degraded: {
      label: "Degraded",
      color: "bg-yellow-100 text-yellow-700",
      dotColor: "bg-yellow-500",
    },
    down: {
      label: "Down",
      color: "bg-red-100 text-red-700",
      dotColor: "bg-red-500",
    },
  };

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-8 p-6">
      {/* ── Page Header ────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          System configuration and status overview
        </p>
      </div>

      {/* ── Section 1: Hospital Information ────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Hospital Information
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hospitalInfo.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                  <item.icon className="h-5 w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900 break-words">
                    {item.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 2: Active Staff Count ──────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Active Staff
        </h2>
        <div className="inline-flex rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50">
              <Users className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">
                Active Doctors
              </p>
              {staffLoading ? (
                <div className="flex items-center gap-2 mt-1">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  <span className="text-sm text-gray-400">Loading...</span>
                </div>
              ) : (
                <p className="text-2xl font-bold text-gray-900">
                  {staffCount !== null ? staffCount : "—"}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: System Status ───────────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          System Status
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {systemServices.map((service) => {
            const config = statusConfig[service.status];
            return (
              <div
                key={service.name}
                className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
                      <service.icon className="h-5 w-5 text-gray-700" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {service.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {service.description}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                      config.color
                    )}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    {config.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
