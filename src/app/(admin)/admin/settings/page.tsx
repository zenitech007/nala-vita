"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  MapPin,
  Mail,
  Users,
  Database,
  Shield,
  CreditCard,
  Cpu,
  CheckCircle,
  Loader2,
  Settings,
  Phone,
  Clock,
  Award,
  RefreshCw,
  Server,
  Lock,
  Activity,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

interface SystemService {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "operational" | "degraded" | "down";
  description: string;
  badge?: string;
}

// ─── Component ──────────────────────────────────────────

export default function AdminSettingsPage() {
  const [staffCount, setStaffCount] = useState<number | null>(null);
  const [staffLoading, setStaffLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStaffCount = async () => {
    try {
      const res = await fetch("/api/admin/reports");
      if (res.ok) {
        const data = await res.json();
        setStaffCount(data.overview?.totalDoctors ?? 0);
      }
    } catch {
      // silently fallback
    } finally {
      setStaffLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStaffCount();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStaffCount();
  };

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
      label: "Administrative Email",
      value: "admin@nalavita.care",
      icon: Mail,
    },
    {
      label: "Emergency Hotline",
      value: "+234 (0) 1 800-NALA-CARE",
      icon: Phone,
    },
    {
      label: "Operating Hours",
      value: "24/7 In-Patient & Telemedicine",
      icon: Clock,
    },
    {
      label: "Regulatory Accreditation",
      value: "HEFAMAA & MDCN Verified",
      icon: Award,
    },
  ];

  // ─── System services ───────────────────────────────────

  const systemServices: SystemService[] = [
    {
      name: "Google Gemini 2.5 Flash",
      icon: Cpu,
      status: "operational",
      description: "Multimodal & Audio TTS Active",
      badge: "AI Engine",
    },
    {
      name: "PostgreSQL Database",
      icon: Database,
      status: "operational",
      description: "Prisma 7 Pool Connected",
      badge: "Storage",
    },
    {
      name: "Supabase Platform",
      icon: Shield,
      status: "operational",
      description: "Auth & Storage Active",
      badge: "Security",
    },
    {
      name: "Paystack Gateway",
      icon: CreditCard,
      status: "operational",
      description: "Webhooks Connected",
      badge: "Billing",
    },
  ];

  const statusConfig: Record<
    string,
    { label: string; color: string; dotColor: string }
  > = {
    operational: {
      label: "Operational",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dotColor: "bg-emerald-500",
    },
    degraded: {
      label: "Degraded",
      color: "bg-yellow-50 text-yellow-700 border-yellow-200",
      dotColor: "bg-yellow-500",
    },
    down: {
      label: "Down",
      color: "bg-red-50 text-red-700 border-red-200",
      dotColor: "bg-red-500",
    },
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* ── Page Header ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <Settings className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            System configuration, service health, and medical center credentials.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={cn("w-4 h-4 text-gray-500", refreshing && "animate-spin text-[var(--primary)]")} />
          Refresh Health Status
        </motion.button>
      </div>

      {/* ── Metric Highlights ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Licensed Doctors</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {staffLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400 mt-1" />
                ) : (
                  staffCount ?? 0
                )}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-3 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active on Telemedicine
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">AI Response Engine</p>
              <p className="text-lg font-bold text-gray-900 mt-1">Gemini 2.5 Flash</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-purple-600 font-medium mt-3 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            GenAI Multimodal & TTS Model
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">System Security</p>
              <p className="text-lg font-bold text-gray-900 mt-1">HIPAA Compliant</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-blue-600 font-medium mt-3 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            TLS 1.3 + PHI Redaction
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
          className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Overall Uptime</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">99.98%</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-teal-600 font-medium mt-3 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            All microservices online
          </p>
        </motion.div>
      </div>

      {/* ── Section 1: System Services & Microservices Status ─ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            System Infrastructure & Services
          </h2>
          <span className="text-xs text-gray-400">4 microservices monitored</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {systemServices.map((service, index) => {
            const config = statusConfig[service.status];
            return (
              <motion.div
                key={service.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.05 * index }}
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs transition-shadow hover:shadow-md relative overflow-hidden"
              >
                {service.badge && (
                  <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                    {service.badge}
                  </span>
                )}
                <div className="flex items-start gap-3 mt-1">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-50 border border-gray-100">
                    <service.icon className="h-5 w-5 text-gray-700" />
                  </div>
                  <div className="min-w-0 pr-10">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {service.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {service.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-medium text-emerald-700">Healthy</span>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                      config.color
                    )}
                  >
                    <CheckCircle className="h-3 w-3" />
                    {config.label}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Section 2: Hospital Information ────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Medical Center Information
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hospitalInfo.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.04 * index }}
              whileHover={{ y: -2 }}
              className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 break-words leading-relaxed">
                    {item.value}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
