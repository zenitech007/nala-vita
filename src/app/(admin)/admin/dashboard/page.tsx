"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Stethoscope,
  CalendarDays,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  ShieldAlert,
  BedDouble,
  UserCog,
  Activity,
  Loader2,
  ChevronRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────

interface Alert {
  id: string;
  type: "vital" | "emergency" | "payment";
  title: string;
  description: string;
  severity: "warning" | "critical" | "info";
  timestamp: string;
  patientName: string;
}

// ─── Component ──────────────────────────────────────────

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // ─── Metric cards ──────────────────────────────────────

  const metrics = [
    {
      label: "Active Patients",
      value: 1248,
      icon: Users,
      lightColor: "bg-blue-50",
      textColor: "text-blue-600",
      change: "+24 this week",
      changeUp: true,
    },
    {
      label: "Doctors Online",
      value: 18,
      icon: Stethoscope,
      lightColor: "bg-emerald-50",
      textColor: "text-emerald-600",
      change: "of 32 total",
      changeUp: true,
    },
    {
      label: "Appointments Today",
      value: 64,
      icon: CalendarDays,
      lightColor: "bg-violet-50",
      textColor: "text-violet-600",
      change: "+8 vs yesterday",
      changeUp: true,
    },
    {
      label: "Revenue Today",
      value: "$12,450",
      icon: DollarSign,
      lightColor: "bg-amber-50",
      textColor: "text-amber-600",
      change: "+15% vs avg",
      changeUp: true,
    },
  ];

  // ─── Quick-access panels ───────────────────────────────

  const quickLinks = [
    {
      label: "Staff Management",
      description: "Manage doctors and nurses",
      icon: UserCog,
      href: "/admin/staff",
      color: "bg-blue-100 text-blue-600",
    },
    {
      label: "Bed Management",
      description: "Ward and bed allocation",
      icon: BedDouble,
      href: "/admin/beds",
      color: "bg-emerald-100 text-emerald-600",
    },
  ];

  // ─── Alerts feed ───────────────────────────────────────

  const alerts: Alert[] = [
    {
      id: "a1",
      type: "vital",
      title: "Abnormal Blood Pressure",
      description: "BP reading 180/120 mmHg — hypertensive crisis range",
      severity: "critical",
      timestamp: "12 min ago",
      patientName: "Alice Brown",
    },
    {
      id: "a2",
      type: "emergency",
      title: "Emergency Flag Raised",
      description: "Patient reported severe chest pain via symptom checker",
      severity: "critical",
      timestamp: "25 min ago",
      patientName: "Robert Smith",
    },
    {
      id: "a3",
      type: "payment",
      title: "Payment Failed",
      description: "Paystack charge declined — insufficient funds",
      severity: "warning",
      timestamp: "1 hr ago",
      patientName: "Diana Lee",
    },
    {
      id: "a4",
      type: "vital",
      title: "Low Oxygen Saturation",
      description: "SpO2 dropped to 89% — below safe threshold",
      severity: "critical",
      timestamp: "1.5 hrs ago",
      patientName: "James Wilson",
    },
    {
      id: "a5",
      type: "vital",
      title: "Elevated Heart Rate",
      description: "Resting HR 118 bpm — tachycardia range",
      severity: "warning",
      timestamp: "2 hrs ago",
      patientName: "Maria Garcia",
    },
    {
      id: "a6",
      type: "payment",
      title: "Payment Failed",
      description: "Paystack charge declined — card expired",
      severity: "warning",
      timestamp: "3 hrs ago",
      patientName: "Kevin Thompson",
    },
  ];

  const ALERT_ICON = {
    vital: Activity,
    emergency: ShieldAlert,
    payment: CreditCard,
  };

  const SEVERITY_STYLE = {
    critical: {
      bg: "bg-red-50",
      border: "border-red-200",
      badge: "bg-red-100 text-red-700",
    },
    warning: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      badge: "bg-amber-100 text-amber-700",
    },
    info: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      badge: "bg-blue-100 text-blue-700",
    },
  };

  // ─── Live stats (bottom row) ───────────────────────────

  const liveStats = [
    { label: "Beds Occupied", value: "42 / 60", pct: 70, color: "bg-blue-500" },
    { label: "Avg Wait Time", value: "18 min", pct: 36, color: "bg-amber-500" },
    { label: "Consultations Active", value: 7, pct: 58, color: "bg-emerald-500" },
    { label: "Pending Lab Orders", value: 23, pct: 45, color: "bg-violet-500" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Admin Dashboard
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                {format(new Date(), "EEEE, MMMM d, yyyy")} &middot; System-wide
                overview
              </p>
            </div>
            <div className="flex items-center gap-3">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition text-sm font-medium text-gray-700"
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* ── Metric Cards ─────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {metrics.map((m) => (
                <div
                  key={m.label}
                  className="bg-white rounded-2xl border border-gray-100 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        m.lightColor
                      )}
                    >
                      <m.icon className={cn("w-6 h-6", m.textColor)} />
                    </div>
                    <TrendingUp
                      className={cn(
                        "w-4 h-4",
                        m.changeUp ? "text-green-400" : "text-gray-300"
                      )}
                    />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{m.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{m.label}</p>
                  <p className="text-xs text-gray-400 mt-2">{m.change}</p>
                </div>
              ))}
            </div>

            {/* ── Main Grid: Alerts + Live Stats ───────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Alerts Feed (2/3) */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-semibold text-gray-900">
                      Alerts Feed
                    </h2>
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                      {alerts.filter((a) => a.severity === "critical").length}{" "}
                      critical
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {alerts.map((alert) => {
                    const AlertIcon = ALERT_ICON[alert.type];
                    const style = SEVERITY_STYLE[alert.severity];
                    return (
                      <div
                        key={alert.id}
                        className={cn(
                          "p-4 rounded-xl border flex items-start gap-4",
                          style.bg,
                          style.border
                        )}
                      >
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                            style.badge
                          )}
                        >
                          <AlertIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-gray-900">
                              {alert.title}
                            </p>
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-xs font-medium",
                                style.badge
                              )}
                            >
                              {alert.severity}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {alert.description}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span className="font-medium text-gray-700">
                              {alert.patientName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {alert.timestamp}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Sidebar: Live Stats + Quick Access */}
              <div className="space-y-6">
                {/* Live Stats */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Live Stats
                  </h2>
                  <div className="space-y-4">
                    {liveStats.map((stat) => (
                      <div key={stat.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-gray-600">
                            {stat.label}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            {stat.value}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              stat.color
                            )}
                            style={{ width: `${stat.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Access Cards */}
                <div className="space-y-3">
                  {quickLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 transition group"
                    >
                      <div
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          link.color
                        )}
                      >
                        <link.icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {link.label}
                        </p>
                        <p className="text-xs text-gray-500">
                          {link.description}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
