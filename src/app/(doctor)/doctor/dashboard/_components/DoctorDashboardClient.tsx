"use client";

import Link from "next/link";
import {
  Users,
  FlaskConical,
  MessageSquare,
  DollarSign,
  Clock,
  AlertTriangle,
  Pill,
  ChevronRight,
  Video,
  MapPin,
  Phone,
  CalendarDays,
  TrendingUp,
  Heart,
  Thermometer,
  Droplets,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface TodayAppointment {
  id: string;
  scheduledAt: string;
  consultationType: "VIDEO" | "IN_PERSON" | "PHONE" | "CHAT";
  urgencyLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string | null;
  status: string;
  patient: {
    user: { firstName: string; lastName: string };
  };
}

interface AbnormalVital {
  id: string;
  patientName: string;
  metric: string;
  value: string;
  severity: "warning" | "critical";
  recordedAt: string;
}

interface RecentPrescription {
  id: string;
  medication: string;
  dosage: string;
  prescribedAt: string;
  patient: {
    user: { firstName: string; lastName: string };
  };
}

interface DashboardData {
  firstName: string;
  todaysAppointments: TodayAppointment[];
  abnormalVitals: AbnormalVital[];
  pendingLabOrders: number;
  unreadMessages: number;
  recentPrescriptions: RecentPrescription[];
  totalPatients: number;
  revenueThisWeek: number;
}

const URGENCY_CONFIG = {
  CRITICAL: { label: "Critical", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", sort: 0 },
  HIGH: { label: "High", color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500", sort: 1 },
  MEDIUM: { label: "Medium", color: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500", sort: 2 },
  LOW: { label: "Low", color: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500", sort: 3 },
};

const TYPE_ICON = {
  VIDEO: Video,
  IN_PERSON: MapPin,
  PHONE: Phone,
  CHAT: MessageSquare,
};

export default function DoctorDashboardClient({ data }: { data: DashboardData }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const sortedQueue = [...data.todaysAppointments].sort(
    (a, b) => URGENCY_CONFIG[a.urgencyLevel].sort - URGENCY_CONFIG[b.urgencyLevel].sort
  );

  const metrics = [
    {
      label: "Patients Today",
      value: data.todaysAppointments.length,
      icon: Users,
      lightColor: "bg-[var(--primary)]/10",
      textColor: "text-[var(--primary)]",
      change: `${data.totalPatients} total patients`,
    },
    {
      label: "Pending Lab Reviews",
      value: data.pendingLabOrders,
      icon: FlaskConical,
      lightColor: "bg-amber-50",
      textColor: "text-amber-600",
      change: "Awaiting review",
    },
    {
      label: "Unread Messages",
      value: data.unreadMessages,
      icon: MessageSquare,
      lightColor: "bg-violet-50",
      textColor: "text-violet-600",
      change: "From patients",
    },
    {
      label: "Revenue This Week",
      value: `$${data.revenueThisWeek.toLocaleString()}`,
      icon: DollarSign,
      lightColor: "bg-emerald-50",
      textColor: "text-emerald-600",
      change: "Completed payments",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {greeting}, Dr. {data.firstName}
              </h1>
              <p className="text-gray-500 mt-1">
                {format(new Date(), "EEEE, MMMM d, yyyy")} &middot; You have{" "}
                <span className="font-semibold text-[var(--primary)]">
                  {data.todaysAppointments.length} patients
                </span>{" "}
                today
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/doctor/appointments"
                className="px-4 py-2 bg-[var(--primary)] hover:opacity-90 text-white font-medium rounded-xl transition text-sm flex items-center gap-2"
              >
                <CalendarDays className="w-4 h-4" />
                View Schedule
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((m) => (
            <div key={m.label} className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", m.lightColor)}>
                  <m.icon className={cn("w-6 h-6", m.textColor)} />
                </div>
                <TrendingUp className="w-4 h-4 text-gray-300" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{m.value}</p>
              <p className="text-sm text-gray-500 mt-1">{m.label}</p>
              <p className="text-xs text-gray-400 mt-2">{m.change}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Today&apos;s Queue</h2>
                <p className="text-sm text-gray-500">Sorted by urgency</p>
              </div>
              <Link
                href="/doctor/appointments"
                className="text-sm text-[var(--primary)] hover:opacity-80 font-medium flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {sortedQueue.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No appointments scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedQueue.map((apt) => {
                  const urgencyCfg = URGENCY_CONFIG[apt.urgencyLevel];
                  const TypeIcon = TYPE_ICON[apt.consultationType];
                  const patientName = `${apt.patient.user.firstName} ${apt.patient.user.lastName}`;
                  const timeStr = format(new Date(apt.scheduledAt), "hh:mm a");
                  return (
                    <div
                      key={apt.id}
                      className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition border border-gray-50"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className={cn("w-3 h-3 rounded-full", urgencyCfg.dot)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-gray-900 text-sm">{patientName}</p>
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", urgencyCfg.color)}>
                            {urgencyCfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{apt.reason || "No reason provided"}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <TypeIcon className="w-3.5 h-3.5" />
                          {apt.consultationType === "IN_PERSON" ? "In Person" : apt.consultationType === "VIDEO" ? "Video" : apt.consultationType}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock className="w-3.5 h-3.5" />
                          {timeStr}
                        </div>
                      </div>
                      <Link
                        href={`/doctor/consultation/${apt.id}`}
                        className="px-3 py-1.5 bg-[var(--primary)] hover:opacity-90 text-white text-xs font-medium rounded-lg transition flex-shrink-0"
                      >
                        Start
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900">Quick Alerts</h2>
              </div>

              {data.abnormalVitals.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No alerts at this time</p>
              ) : (
                <div className="space-y-3">
                  {data.abnormalVitals.map((vital) => (
                    <div
                      key={vital.id}
                      className={cn(
                        "p-3 rounded-xl border",
                        vital.severity === "critical" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-gray-900">{vital.patientName}</p>
                        <span
                          className={cn(
                            "text-xs font-medium px-1.5 py-0.5 rounded-full",
                            vital.severity === "critical" ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-800"
                          )}
                        >
                          {vital.severity}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {vital.metric === "Blood Pressure" && <Droplets className="w-3.5 h-3.5 text-gray-400" />}
                        {vital.metric === "Heart Rate" && <Heart className="w-3.5 h-3.5 text-gray-400" />}
                        {vital.metric === "Blood Sugar" && <Thermometer className="w-3.5 h-3.5 text-gray-400" />}
                        <span className="text-gray-700">
                          {vital.metric}: <strong>{vital.value}</strong>
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{vital.recordedAt}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Pill className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-semibold text-gray-900">Recent Prescriptions</h2>
              </div>

              {data.recentPrescriptions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No recent prescriptions</p>
              ) : (
                <div className="space-y-3">
                  {data.recentPrescriptions.map((rx) => (
                    <div key={rx.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition">
                      <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Pill className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{rx.medication}</p>
                        <p className="text-xs text-gray-500">
                          {rx.patient.user.firstName} {rx.patient.user.lastName} &middot; {rx.dosage}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {format(new Date(rx.prescribedAt), "MMM d")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
