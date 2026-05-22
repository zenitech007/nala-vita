"use client";
// This component receives pre-loaded data as props — it never shows a blank state.
// All interactive behaviour (quick actions, alert dismissal) lives here.

import Link from "next/link";
import {
  Calendar, Pill, Activity, MessageSquare, Plus,
  Stethoscope, FileText, AlertTriangle, TrendingUp,
  Clock, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Props {
  data: {
    firstName: string;
    upcomingAppointments: Array<{
      id: string;
      scheduledAt: Date;
      consultationType: string;
      doctor: { user: { firstName: string; lastName: string } };
    }>;
    activeMedications: Array<{
      id: string;
      medication: string;
      dosage: string;
      frequency: string;
    }>;
    latestVital: {
      bloodPressure?: string | null;
      heartRate?: number | null;
    } | null;
    unreadMessages: number;
    notifications: Array<{
      id: string;
      title: string;
      message: string;
      type: string;
      createdAt: Date;
    }>;
  };
}

export default function PatientDashboardClient({ data }: Props) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const metricCards = [
    {
      label: "Upcoming Appointments",
      value: data.upcomingAppointments.length,
      icon: Calendar,
      lightColor: "bg-blue-50",
      textColor: "text-blue-600",
      href: "/patient/appointments",
    },
    {
      label: "Active Medications",
      value: data.activeMedications.length,
      icon: Pill,
      lightColor: "bg-emerald-50",
      textColor: "text-emerald-600",
      href: "/patient/medications",
    },
    {
      label: "Latest Blood Pressure",
      value: data.latestVital?.bloodPressure ?? "—",
      subtitle: "mmHg",
      icon: Activity,
      lightColor: "bg-violet-50",
      textColor: "text-violet-600",
      href: "/patient/vitals",
    },
    {
      label: "Unread Messages",
      value: data.unreadMessages,
      icon: MessageSquare,
      lightColor: "bg-amber-50",
      textColor: "text-amber-600",
      href: "/patient/chat",
    },
  ];

  const quickActions = [
    { label: "Book Appointment", icon: Plus, href: "/patient/appointments?action=book", color: "bg-blue-600 hover:bg-blue-700" },
    { label: "Check Symptoms", icon: Stethoscope, href: "/patient/symptom-checker", color: "bg-emerald-600 hover:bg-emerald-700" },
    { label: "Chat with Doctor", icon: MessageSquare, href: "/patient/chat", color: "bg-violet-600 hover:bg-violet-700" },
    { label: "View Records", icon: FileText, href: "/patient/records", color: "bg-amber-600 hover:bg-amber-700" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}, {data.firstName}
          </h1>
          <p className="text-gray-500 mt-1">Here&apos;s your health overview</p>
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
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", card.lightColor)}>
                  <card.icon className={cn("w-6 h-6", card.textColor)} />
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition" />
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                {card.subtitle && <p className="text-xs text-gray-400 mt-0.5">{card.subtitle}</p>}
                <p className="text-sm text-gray-500 mt-1">{card.label}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={cn("flex flex-col items-center gap-3 p-5 rounded-2xl text-white transition-transform hover:scale-[1.02]", action.color)}
              >
                <action.icon className="w-7 h-7" />
                <span className="text-sm font-medium text-center">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming appointments + Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            {data.upcomingAppointments.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No upcoming appointments.</p>
            ) : (
              <div className="space-y-4">
                {data.upcomingAppointments.map((appt) => (
                  <div key={appt.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 transition">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        Dr. {appt.doctor.user.firstName} {appt.doctor.user.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{appt.consultationType}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {format(new Date(appt.scheduledAt), "MMM d, h:mm a")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            {data.notifications.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">You&apos;re all caught up.</p>
            ) : (
              <div className="space-y-3">
                {data.notifications.map((n) => (
                  <div key={n.id} className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <p className="text-sm font-medium text-amber-900">{n.title}</p>
                    <p className="text-xs text-amber-700 mt-0.5">{n.message}</p>
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