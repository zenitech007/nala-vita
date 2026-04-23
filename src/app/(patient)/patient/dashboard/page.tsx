"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Pill,
  Activity,
  MessageSquare,
  Plus,
  Stethoscope,
  FileText,
  AlertTriangle,
  TrendingUp,
  Clock,
  ChevronRight,
  Heart,
  Thermometer,
  Droplets,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface DashboardMetrics {
  upcomingAppointments: number;
  activeMedications: number;
  recentVitals: { label: string; value: string; status: "normal" | "abnormal" };
  unreadMessages: number;
}

interface RecentActivity {
  id: string;
  type: "appointment" | "prescription" | "vital" | "lab" | "message";
  title: string;
  description: string;
  time: string;
}

interface HealthAlert {
  id: string;
  metric: string;
  value: string;
  message: string;
  severity: "warning" | "critical";
}

export default function PatientDashboard() {
  const [userName, setUserName] = useState("Patient");
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
          user.user_metadata.first_name || user.user_metadata.name || "Patient"
        );
      }
    }
    getUser();
  }, []);

  // Placeholder metrics — will be replaced with real API calls
  const metrics: DashboardMetrics = {
    upcomingAppointments: 3,
    activeMedications: 5,
    recentVitals: { label: "Blood Pressure", value: "120/80", status: "normal" },
    unreadMessages: 2,
  };

  const recentActivity: RecentActivity[] = [
    {
      id: "1",
      type: "appointment",
      title: "Appointment Confirmed",
      description: "Dr. Sarah Johnson - General Checkup",
      time: "2 hours ago",
    },
    {
      id: "2",
      type: "prescription",
      title: "Prescription Renewed",
      description: "Lisinopril 10mg - 90 day supply",
      time: "1 day ago",
    },
    {
      id: "3",
      type: "vital",
      title: "Vitals Recorded",
      description: "Blood pressure, heart rate, and temperature",
      time: "2 days ago",
    },
    {
      id: "4",
      type: "lab",
      title: "Lab Results Available",
      description: "Complete Blood Count (CBC) results ready",
      time: "3 days ago",
    },
    {
      id: "5",
      type: "message",
      title: "New Message",
      description: "Dr. Johnson replied to your question",
      time: "3 days ago",
    },
  ];

  const healthAlerts: HealthAlert[] = [
    {
      id: "1",
      metric: "Blood Pressure",
      value: "145/95 mmHg",
      message: "Your blood pressure is above the normal range. Consider scheduling a follow-up.",
      severity: "warning",
    },
    {
      id: "2",
      metric: "Blood Sugar",
      value: "180 mg/dL",
      message: "Fasting blood sugar is elevated. Please consult your doctor.",
      severity: "critical",
    },
  ];

  const metricCards = [
    {
      label: "Upcoming Appointments",
      value: metrics.upcomingAppointments,
      icon: Calendar,
      color: "bg-blue-500",
      lightColor: "bg-blue-50",
      textColor: "text-blue-600",
      href: "/patient/appointments",
    },
    {
      label: "Active Medications",
      value: metrics.activeMedications,
      icon: Pill,
      color: "bg-emerald-500",
      lightColor: "bg-emerald-50",
      textColor: "text-emerald-600",
      href: "/patient/prescriptions",
    },
    {
      label: "Recent Vitals",
      value: metrics.recentVitals.value,
      subtitle: metrics.recentVitals.label,
      icon: Activity,
      color: "bg-violet-500",
      lightColor: "bg-violet-50",
      textColor: "text-violet-600",
      href: "/patient/vitals",
    },
    {
      label: "Unread Messages",
      value: metrics.unreadMessages,
      icon: MessageSquare,
      color: "bg-amber-500",
      lightColor: "bg-amber-50",
      textColor: "text-amber-600",
      href: "/patient/messages",
    },
  ];

  const quickActions = [
    {
      label: "Book Appointment",
      icon: Plus,
      href: "/patient/appointments?action=book",
      color: "bg-blue-600 hover:bg-blue-700",
    },
    {
      label: "Check Symptoms",
      icon: Stethoscope,
      href: "/patient/symptom-checker",
      color: "bg-emerald-600 hover:bg-emerald-700",
    },
    {
      label: "Chat with Doctor",
      icon: MessageSquare,
      href: "/patient/messages",
      color: "bg-violet-600 hover:bg-violet-700",
    },
    {
      label: "View Records",
      icon: FileText,
      href: "/patient/lab-results",
      color: "bg-amber-600 hover:bg-amber-700",
    },
  ];

  const activityIcon = (type: RecentActivity["type"]) => {
    switch (type) {
      case "appointment":
        return <Calendar className="w-4 h-4" />;
      case "prescription":
        return <Pill className="w-4 h-4" />;
      case "vital":
        return <Activity className="w-4 h-4" />;
      case "lab":
        return <FileText className="w-4 h-4" />;
      case "message":
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const activityColor = (type: RecentActivity["type"]) => {
    switch (type) {
      case "appointment":
        return "bg-blue-100 text-blue-600";
      case "prescription":
        return "bg-emerald-100 text-emerald-600";
      case "vital":
        return "bg-violet-100 text-violet-600";
      case "lab":
        return "bg-orange-100 text-orange-600";
      case "message":
        return "bg-amber-100 text-amber-600";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {greeting}, {userName}
              </h1>
              <p className="text-gray-500 mt-1">
                Here&apos;s an overview of your health today
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/patient/settings"
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition text-sm font-medium text-gray-700"
              >
                <Heart className="w-4 h-4" />
                My Profile
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {metricCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    card.lightColor
                  )}
                >
                  <card.icon className={cn("w-6 h-6", card.textColor)} />
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition" />
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                {card.subtitle && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {card.subtitle}
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-1">{card.label}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={cn(
                  "flex flex-col items-center gap-3 p-5 rounded-2xl text-white transition-transform hover:scale-[1.02]",
                  action.color
                )}
              >
                <action.icon className="w-7 h-7" />
                <span className="text-sm font-medium text-center">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Activity
              </h2>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 transition"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                      activityColor(item.type)
                    )}
                  >
                    {activityIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {item.title}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {item.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    {item.time}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Health Alerts */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Health Alerts
              </h2>
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>

            {healthAlerts.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-green-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  All your vitals are within normal ranges.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {healthAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "p-4 rounded-xl border",
                      alert.severity === "critical"
                        ? "bg-red-50 border-red-200"
                        : "bg-amber-50 border-amber-200"
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          alert.severity === "critical"
                            ? "bg-red-100"
                            : "bg-amber-100"
                        )}
                      >
                        {alert.metric === "Blood Pressure" ? (
                          <Droplets
                            className={cn(
                              "w-4 h-4",
                              alert.severity === "critical"
                                ? "text-red-600"
                                : "text-amber-600"
                            )}
                          />
                        ) : (
                          <Thermometer
                            className={cn(
                              "w-4 h-4",
                              alert.severity === "critical"
                                ? "text-red-600"
                                : "text-amber-600"
                            )}
                          />
                        )}
                      </div>
                      <div>
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            alert.severity === "critical"
                              ? "text-red-800"
                              : "text-amber-800"
                          )}
                        >
                          {alert.metric}
                        </p>
                        <p
                          className={cn(
                            "text-xs font-medium",
                            alert.severity === "critical"
                              ? "text-red-600"
                              : "text-amber-600"
                          )}
                        >
                          {alert.value}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "ml-auto text-xs font-semibold px-2 py-1 rounded-full",
                          alert.severity === "critical"
                            ? "bg-red-200 text-red-800"
                            : "bg-amber-200 text-amber-800"
                        )}
                      >
                        {alert.severity === "critical" ? "Critical" : "Warning"}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-sm",
                        alert.severity === "critical"
                          ? "text-red-700"
                          : "text-amber-700"
                      )}
                    >
                      {alert.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
