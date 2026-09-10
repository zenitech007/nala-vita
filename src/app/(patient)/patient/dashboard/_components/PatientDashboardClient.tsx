"use client";
// This component receives pre-loaded data as props — it never shows a blank state.
// All interactive behaviour (quick actions, alert dismissal) lives here.

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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import HealthDashboard from "@/components/dashboard/HealthDashboard";
import MedicationSchedule from "@/components/medications/MedicationSchedule";

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

  const quickActions = [
    {
      label: "Book Appointment",
      icon: Plus,
      href: "/patient/appointments?action=book",
      primary: true,
    },
    {
      label: "Check Symptoms",
      icon: Stethoscope,
      href: "/patient/symptom-checker",
      primary: false,
    },
    {
      label: "Chat with Doctor",
      icon: MessageSquare,
      href: "/patient/chat",
      primary: false,
    },
    {
      label: "View Records",
      icon: FileText,
      href: "/patient/records",
      primary: false,
    },
  ];

  // Adapt activeMedications (DB shape) to MedicationSchedule prop shape
  const medicationsForSchedule = data.activeMedications.map((m) => ({
    id: m.id,
    name: m.medication,
    dosage: m.dosage,
    frequency: m.frequency,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <PageHeader
          title={`${greeting}, ${data.firstName}`}
          subtitle="Here's your health overview"
        />

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href="/patient/appointments" className="block">
            <MetricCard
              label="Upcoming Appointments"
              value={data.upcomingAppointments.length}
              icon={<Calendar className="w-5 h-5" />}
              tone="primary"
            />
          </Link>
          <Link href="/patient/medications" className="block">
            <MetricCard
              label="Active Medications"
              value={data.activeMedications.length}
              icon={<Pill className="w-5 h-5" />}
              tone="success"
            />
          </Link>
          <Link href="/patient/vitals" className="block">
            <MetricCard
              label="Latest BP (mmHg)"
              value={data.latestVital?.bloodPressure ?? "—"}
              icon={<Activity className="w-5 h-5" />}
              tone="neutral"
            />
          </Link>
          <Link href="/patient/chat" className="block">
            <MetricCard
              label="Unread Messages"
              value={data.unreadMessages}
              icon={<MessageSquare className="w-5 h-5" />}
              tone="warning"
            />
          </Link>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={cn(
                  "flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-200 shadow-2xs hover:shadow-md hover:-translate-y-1",
                  action.primary
                    ? "bg-[var(--primary)] text-white hover:opacity-95"
                    : "bg-white border border-gray-100 text-gray-700 hover:bg-gray-50/80 hover:border-gray-200"
                )}
              >
                <action.icon className="w-7 h-7" />
                <span className="text-sm font-medium text-center">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Daily Vitals widget (Phase 3 component) */}
        {/* TODO: wire initialVitals + onUpdate to a daily-log API once the endpoint exists */}
        <HealthDashboard />

        {/* Medications + Appointments side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SectionCard
            title="Active Prescriptions"
            action={
              <Link
                href="/patient/medications"
                className="text-sm font-medium text-[var(--primary)] hover:opacity-80"
              >
                View all
              </Link>
            }
          >
            <MedicationSchedule medications={medicationsForSchedule} />
          </SectionCard>

          <SectionCard
            title="Upcoming Appointments"
            action={<TrendingUp className="w-5 h-5 text-gray-400" />}
          >
            {data.upcomingAppointments.length === 0 ? (
              <EmptyState
                icon={<Calendar className="w-6 h-6" />}
                title="No upcoming appointments"
                description="Book a visit when you're ready."
                action={
                  <Link
                    href="/patient/appointments?action=book"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90"
                  >
                    <Plus className="w-4 h-4" /> Book now
                  </Link>
                }
              />
            ) : (
              <div className="space-y-4">
                {data.upcomingAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 transition"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center flex-shrink-0">
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
          </SectionCard>
        </div>

        {/* Notifications */}
        <SectionCard
          title="Notifications"
          action={<AlertTriangle className="w-5 h-5 text-amber-500" />}
        >
          {data.notifications.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="w-6 h-6" />}
              title="You're all caught up"
              description="New alerts will appear here."
            />
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
        </SectionCard>
      </main>
    </div>
  );
}
