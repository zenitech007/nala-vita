"use client";

import { useEffect, useState } from "react";
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
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────

interface TodayAppointment {
  id: string;
  patientName: string;
  time: string;
  type: "VIDEO" | "IN_PERSON" | "PHONE" | "CHAT";
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  status: string;
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
  patientName: string;
  medication: string;
  dosage: string;
  prescribedAt: string;
}

// ─── Urgency helpers ─────────────────────────────────────

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

export default function DoctorDashboard() {
  const [userName, setUserName] = useState("Doctor");
  const [greeting, setGreeting] = useState("Good morning");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.user_metadata) {
        setUserName(
          user.user_metadata.first_name || user.user_metadata.name || "Doctor"
        );
      }
    }
    getUser();
  }, []);

  // ─── Placeholder data ───────────────────────────────────

  const metrics = [
    {
      label: "Patients Today",
      value: 12,
      icon: Users,
      lightColor: "bg-blue-50",
      textColor: "text-blue-600",
      change: "+3 from yesterday",
    },
    {
      label: "Pending Lab Reviews",
      value: 5,
      icon: FlaskConical,
      lightColor: "bg-amber-50",
      textColor: "text-amber-600",
      change: "2 urgent",
    },
    {
      label: "Unread Messages",
      value: 8,
      icon: MessageSquare,
      lightColor: "bg-violet-50",
      textColor: "text-violet-600",
      change: "3 new today",
    },
    {
      label: "Revenue This Week",
      value: "$4,250",
      icon: DollarSign,
      lightColor: "bg-emerald-50",
      textColor: "text-emerald-600",
      change: "+12% vs last week",
    },
  ];

  const todaysQueue: TodayAppointment[] = ([
    { id: "1", patientName: "Alice Brown", time: "09:00 AM", type: "VIDEO" as const, urgency: "CRITICAL" as const, reason: "Chest pain and shortness of breath", status: "CONFIRMED" },
    { id: "2", patientName: "Robert Smith", time: "09:30 AM", type: "IN_PERSON" as const, urgency: "HIGH" as const, reason: "Severe migraine - 3 days", status: "CONFIRMED" },
    { id: "3", patientName: "Diana Lee", time: "10:00 AM", type: "VIDEO" as const, urgency: "MEDIUM" as const, reason: "Follow-up blood pressure check", status: "SCHEDULED" },
    { id: "4", patientName: "James Wilson", time: "10:30 AM", type: "IN_PERSON" as const, urgency: "LOW" as const, reason: "Annual physical exam", status: "SCHEDULED" },
    { id: "5", patientName: "Maria Garcia", time: "11:00 AM", type: "PHONE" as const, urgency: "MEDIUM" as const, reason: "Medication side effects", status: "SCHEDULED" },
    { id: "6", patientName: "Kevin Thompson", time: "01:00 PM", type: "VIDEO" as const, urgency: "HIGH" as const, reason: "Post-surgery follow-up", status: "SCHEDULED" },
  ] satisfies TodayAppointment[]).sort((a, b) => URGENCY_CONFIG[a.urgency].sort - URGENCY_CONFIG[b.urgency].sort);

  const abnormalVitals: AbnormalVital[] = [
    { id: "1", patientName: "Alice Brown", metric: "Blood Pressure", value: "165/105 mmHg", severity: "critical", recordedAt: "2 hours ago" },
    { id: "2", patientName: "Robert Smith", metric: "Heart Rate", value: "112 bpm", severity: "warning", recordedAt: "4 hours ago" },
    { id: "3", patientName: "Kevin Thompson", metric: "Blood Sugar", value: "210 mg/dL", severity: "critical", recordedAt: "6 hours ago" },
  ];

  const recentPrescriptions: RecentPrescription[] = [
    { id: "1", patientName: "Diana Lee", medication: "Lisinopril 10mg", dosage: "Once daily", prescribedAt: "Today" },
    { id: "2", patientName: "James Wilson", medication: "Metformin 500mg", dosage: "Twice daily", prescribedAt: "Today" },
    { id: "3", patientName: "Maria Garcia", medication: "Amoxicillin 500mg", dosage: "Three times daily", prescribedAt: "Yesterday" },
    { id: "4", patientName: "Alice Brown", medication: "Atorvastatin 20mg", dosage: "Once daily", prescribedAt: "Yesterday" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {greeting}, Dr. {userName}
              </h1>
              <p className="text-gray-500 mt-1">
                {format(new Date(), "EEEE, MMMM d, yyyy")} &middot; You have{" "}
                <span className="font-semibold text-blue-600">{todaysQueue.length} patients</span>{" "}
                today
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/doctor/appointments"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition text-sm flex items-center gap-2"
              >
                <CalendarDays className="w-4 h-4" />
                View Schedule
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Metric Cards */}
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
                <TrendingUp className="w-4 h-4 text-gray-300" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{m.value}</p>
              <p className="text-sm text-gray-500 mt-1">{m.label}</p>
              <p className="text-xs text-gray-400 mt-2">{m.change}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ─── Today's Queue (2/3 width) ─── */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Today&apos;s Queue
                </h2>
                <p className="text-sm text-gray-500">Sorted by urgency</p>
              </div>
              <Link
                href="/doctor/appointments"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="space-y-3">
              {todaysQueue.map((apt) => {
                const urgencyCfg = URGENCY_CONFIG[apt.urgency];
                const TypeIcon = TYPE_ICON[apt.type];
                return (
                  <div
                    key={apt.id}
                    className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition border border-gray-50"
                  >
                    {/* Urgency dot */}
                    <div className="flex flex-col items-center gap-1">
                      <div className={cn("w-3 h-3 rounded-full", urgencyCfg.dot)} />
                    </div>

                    {/* Patient info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-gray-900 text-sm">
                          {apt.patientName}
                        </p>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium border",
                            urgencyCfg.color
                          )}
                        >
                          {urgencyCfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {apt.reason}
                      </p>
                    </div>

                    {/* Time & type */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <TypeIcon className="w-3.5 h-3.5" />
                        {apt.type === "IN_PERSON" ? "In Person" : apt.type === "VIDEO" ? "Video" : apt.type}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        {apt.time}
                      </div>
                    </div>

                    {/* Action */}
                    <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition flex-shrink-0">
                      Start
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Right Sidebar ─── */}
          <div className="space-y-6">
            {/* Quick Alerts — Abnormal Vitals */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Quick Alerts
                </h2>
              </div>

              <div className="space-y-3">
                {abnormalVitals.map((vital) => (
                  <div
                    key={vital.id}
                    className={cn(
                      "p-3 rounded-xl border",
                      vital.severity === "critical"
                        ? "bg-red-50 border-red-200"
                        : "bg-amber-50 border-amber-200"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {vital.patientName}
                      </p>
                      <span
                        className={cn(
                          "text-xs font-medium px-1.5 py-0.5 rounded-full",
                          vital.severity === "critical"
                            ? "bg-red-200 text-red-800"
                            : "bg-amber-200 text-amber-800"
                        )}
                      >
                        {vital.severity}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {vital.metric === "Blood Pressure" && (
                        <Droplets className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      {vital.metric === "Heart Rate" && (
                        <Heart className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      {vital.metric === "Blood Sugar" && (
                        <Thermometer className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      <span className="text-gray-700">
                        {vital.metric}: <strong>{vital.value}</strong>
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {vital.recordedAt}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Prescriptions */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Pill className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Recent Prescriptions
                </h2>
              </div>

              <div className="space-y-3">
                {recentPrescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition"
                  >
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Pill className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {rx.medication}
                      </p>
                      <p className="text-xs text-gray-500">
                        {rx.patientName} &middot; {rx.dosage}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {rx.prescribedAt}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
