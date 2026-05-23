"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Calendar,
  List,
  Clock,
  Video,
  MapPin,
  Phone,
  MessageSquare,
  User,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
  X,
  FileText,
  Activity,
  Pill,
  AlertTriangle,
  Mail,
  PhoneCall,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";

// ─── Types ───────────────────────────────────────────────

type TabKey = "upcoming" | "in_progress" | "completed" | "cancelled";
type ViewMode = "calendar" | "list";

interface AppointmentPatient {
  id: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string | null;
  allergies: string[];
  user: { firstName: string; lastName: string; avatarUrl: string | null; email: string; phone: string | null };
  vitals?: { id: string; bloodPressure: string | null; heartRate: number | null; temperature: number | null; recordedAt: string }[];
  prescriptions?: { id: string; medication: string; dosage: string; frequency: string; isActive: boolean }[];
  medicalNotes?: { id: string; title: string; content: string; createdAt: string }[];
}

interface DoctorAppointment {
  id: string;
  scheduledAt: string;
  duration: number;
  status: string;
  consultationType: string;
  urgencyLevel: string;
  reason: string | null;
  notes: string | null;
  patient: AppointmentPatient;
}

const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: "Critical", color: "bg-red-100 text-red-700" },
  HIGH: { label: "High", color: "bg-orange-100 text-orange-700" },
  MEDIUM: { label: "Medium", color: "bg-yellow-100 text-yellow-700" },
  LOW: { label: "Low", color: "bg-green-100 text-green-700" },
};

const STATUS_TABS: { key: TabKey; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const TYPE_ICON: Record<string, typeof Video> = {
  VIDEO: Video,
  IN_PERSON: MapPin,
  PHONE: Phone,
  CHAT: MessageSquare,
};

export default function DoctorAppointmentsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("upcoming");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<DoctorAppointment | null>(null);
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const statusMap: Record<TabKey, string> = {
        upcoming: "upcoming",
        in_progress: "upcoming", // API groups these together
        completed: "past",
        cancelled: "cancelled",
      };
      const res = await fetch(`/api/appointments?status=${statusMap[activeTab]}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || []);
      }
    } catch {
      // placeholder data handles no-api case
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Placeholder data for UI
  const displayAppointments: DoctorAppointment[] =
    appointments.length > 0
      ? appointments
      : generatePlaceholderAppointments(activeTab);

  const calendarDays = Array.from({ length: 7 }, (_, i) => addDays(calendarWeekStart, i));

  const getAppointmentsForDay = (date: Date) =>
    displayAppointments.filter((a) => isSameDay(new Date(a.scheduledAt), date));

  const calculateAge = (dob: string) => {
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchAppointments();
    } catch {
      // handle error
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/doctor/dashboard" className="text-gray-400 hover:text-gray-600">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
                <p className="text-gray-500 text-sm">Manage your patient appointments</p>
              </div>
            </div>

            {/* View Toggle */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition",
                  viewMode === "list" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <List className="w-4 h-4" />
                List
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition",
                  viewMode === "calendar" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Calendar className="w-4 h-4" />
                Calendar
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-6">
        {/* Main content area */}
        <div className={cn("flex-1 min-w-0", selectedAppointment ? "lg:mr-0" : "")}>
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-5 py-2.5 rounded-lg text-sm font-medium transition",
                  activeTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
          ) : viewMode === "list" ? (
            /* ─── List View ─── */
            <div className="space-y-3">
              {displayAppointments.length === 0 ? (
                <div className="text-center py-20">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No {activeTab.replace("_", " ")} appointments</p>
                </div>
              ) : (
                displayAppointments.map((apt) => {
                  const urgencyCfg = URGENCY_CONFIG[apt.urgencyLevel] || URGENCY_CONFIG.LOW;
                  const TypeIcon = TYPE_ICON[apt.consultationType] || MapPin;
                  const age = calculateAge(apt.patient.dateOfBirth);

                  return (
                    <div
                      key={apt.id}
                      onClick={() => setSelectedAppointment(apt)}
                      className={cn(
                        "bg-white rounded-xl border p-5 hover:shadow-md transition-shadow cursor-pointer",
                        selectedAppointment?.id === apt.id ? "border-[var(--primary)] ring-1 ring-[var(--primary)]/30" : "border-gray-100"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-gray-400" />
                        </div>

                        {/* Patient info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-semibold text-gray-900 text-sm">
                              {apt.patient.user.firstName} {apt.patient.user.lastName}
                            </p>
                            <span className="text-xs text-gray-400">
                              {age} yrs &middot; {apt.patient.gender}
                            </span>
                            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", urgencyCfg.color)}>
                              {urgencyCfg.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{apt.reason || "No reason provided"}</p>
                          <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {format(new Date(apt.scheduledAt), "MMM d, yyyy")}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {format(new Date(apt.scheduledAt), "h:mm a")}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <TypeIcon className="w-3.5 h-3.5" />
                              {apt.consultationType === "IN_PERSON" ? "In Person" : apt.consultationType === "VIDEO" ? "Video" : apt.consultationType}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {(apt.status === "SCHEDULED" || apt.status === "CONFIRMED") && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStatusUpdate(apt.id, "IN_PROGRESS"); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary)] hover:opacity-90 text-white text-xs font-medium rounded-lg transition"
                              >
                                <Play className="w-3.5 h-3.5" />
                                Start
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg transition"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Reschedule
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStatusUpdate(apt.id, "CANCELLED"); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg transition"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Cancel
                              </button>
                            </>
                          )}
                          {apt.status === "IN_PROGRESS" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStatusUpdate(apt.id, "COMPLETED"); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* ─── Calendar View ─── */
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* Calendar header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <button
                  onClick={() => setCalendarWeekStart((prev) => addDays(prev, -7))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-500" />
                </button>
                <span className="font-semibold text-gray-900">
                  {format(calendarWeekStart, "MMMM d")} &ndash;{" "}
                  {format(addDays(calendarWeekStart, 6), "MMMM d, yyyy")}
                </span>
                <button
                  onClick={() => setCalendarWeekStart((prev) => addDays(prev, 7))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 divide-x divide-gray-100">
                {calendarDays.map((day) => {
                  const dayAppts = getAppointmentsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div key={day.toISOString()} className="min-h-[200px]">
                      <div
                        className={cn(
                          "px-3 py-2 text-center border-b border-gray-100",
                          isToday ? "bg-[var(--primary)]/10" : "bg-gray-50"
                        )}
                      >
                        <p className="text-xs text-gray-400">{format(day, "EEE")}</p>
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            isToday ? "text-[var(--primary)]" : "text-gray-900"
                          )}
                        >
                          {format(day, "d")}
                        </p>
                      </div>
                      <div className="p-2 space-y-1">
                        {dayAppts.map((apt) => {
                          const urgencyCfg = URGENCY_CONFIG[apt.urgencyLevel] || URGENCY_CONFIG.LOW;
                          return (
                            <button
                              key={apt.id}
                              onClick={() => setSelectedAppointment(apt)}
                              className={cn(
                                "w-full text-left px-2 py-1.5 rounded-lg text-xs transition",
                                urgencyCfg.color,
                                "hover:opacity-80"
                              )}
                            >
                              <p className="font-medium truncate">
                                {apt.patient.user.firstName} {apt.patient.user.lastName}
                              </p>
                              <p className="opacity-70">
                                {format(new Date(apt.scheduledAt), "h:mm a")}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ─── Patient Detail Sidebar ─── */}
        {selectedAppointment && (
          <PatientSidebar
            appointment={selectedAppointment}
            onClose={() => setSelectedAppointment(null)}
            calculateAge={calculateAge}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Patient Detail Sidebar
// ═══════════════════════════════════════════════════════════

function PatientSidebar({
  appointment,
  onClose,
  calculateAge,
}: {
  appointment: DoctorAppointment;
  onClose: () => void;
  calculateAge: (dob: string) => number;
}) {
  const patient = appointment.patient;
  const age = calculateAge(patient.dateOfBirth);

  return (
    <div className="w-96 bg-white rounded-2xl border border-gray-100 flex-shrink-0 overflow-y-auto max-h-[calc(100vh-12rem)] sticky top-8">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Patient Details</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center">
            <User className="w-6 h-6 text-[var(--primary)]" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {patient.user.firstName} {patient.user.lastName}
            </p>
            <p className="text-xs text-gray-500">
              {age} yrs &middot; {patient.gender}
              {patient.bloodType ? ` &middot; ${patient.bloodType}` : ""}
            </p>
          </div>
        </div>
        {/* Contact */}
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" />
            {patient.user.email}
          </span>
          {patient.user.phone && (
            <span className="inline-flex items-center gap-1">
              <PhoneCall className="w-3.5 h-3.5" />
              {patient.user.phone}
            </span>
          )}
        </div>
      </div>

      {/* Appointment info */}
      <div className="px-6 py-4 border-b border-gray-100">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Appointment</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Date</span>
            <span className="text-gray-900">{format(new Date(appointment.scheduledAt), "MMM d, yyyy h:mm a")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Type</span>
            <span className="text-gray-900">
              {appointment.consultationType === "IN_PERSON" ? "In Person" : appointment.consultationType}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Reason</span>
            <span className="text-gray-900 text-right max-w-[200px]">{appointment.reason || "—"}</span>
          </div>
          {appointment.notes && (
            <div className="flex justify-between">
              <span className="text-gray-500">Notes</span>
              <span className="text-gray-900 text-right max-w-[200px]">{appointment.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Allergies */}
      {patient.allergies && patient.allergies.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            Allergies
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {patient.allergies.map((a) => (
              <span key={a} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-lg font-medium">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Vitals */}
      {patient.vitals && patient.vitals.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" />
            Recent Vitals
          </h4>
          <div className="space-y-2">
            {patient.vitals.slice(0, 3).map((v) => (
              <div key={v.id} className="flex justify-between text-xs">
                <span className="text-gray-500">{format(new Date(v.recordedAt), "MMM d")}</span>
                <div className="flex gap-3 text-gray-700">
                  {v.bloodPressure && <span>BP: {v.bloodPressure}</span>}
                  {v.heartRate && <span>HR: {v.heartRate}</span>}
                  {v.temperature && <span>Temp: {v.temperature}°F</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Prescriptions */}
      {patient.prescriptions && patient.prescriptions.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Pill className="w-3.5 h-3.5" />
            Active Medications
          </h4>
          <div className="space-y-1.5">
            {patient.prescriptions.map((rx) => (
              <div key={rx.id} className="text-xs">
                <span className="font-medium text-gray-900">{rx.medication}</span>
                <span className="text-gray-500"> &middot; {rx.dosage} &middot; {rx.frequency}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medical Notes */}
      {patient.medicalNotes && patient.medicalNotes.length > 0 && (
        <div className="px-6 py-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            Recent Notes
          </h4>
          <div className="space-y-2">
            {patient.medicalNotes.slice(0, 3).map((note) => (
              <div key={note.id} className="p-2 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-900">{note.title}</p>
                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{note.content}</p>
                <p className="text-xs text-gray-400 mt-1">{format(new Date(note.createdAt), "MMM d, yyyy")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Placeholder data generator
// ═══════════════════════════════════════════════════════════

function generatePlaceholderAppointments(tab: TabKey): DoctorAppointment[] {
  const statusForTab: Record<TabKey, string> = {
    upcoming: "CONFIRMED",
    in_progress: "IN_PROGRESS",
    completed: "COMPLETED",
    cancelled: "CANCELLED",
  };

  const patients = [
    { first: "Alice", last: "Brown", gender: "Female", dob: "1985-03-15", blood: "A+", allergies: ["Penicillin"] },
    { first: "Robert", last: "Smith", gender: "Male", dob: "1978-07-22", blood: "O-", allergies: [] },
    { first: "Diana", last: "Lee", gender: "Female", dob: "1992-11-08", blood: "B+", allergies: ["Sulfa drugs", "Latex"] },
    { first: "James", last: "Wilson", gender: "Male", dob: "1965-01-30", blood: "AB+", allergies: ["Aspirin"] },
    { first: "Maria", last: "Garcia", gender: "Female", dob: "1990-06-12", blood: "O+", allergies: [] },
  ];

  const reasons = [
    "Chest pain and shortness of breath",
    "Severe migraine - 3 days",
    "Follow-up blood pressure check",
    "Annual physical exam",
    "Medication side effects review",
  ];

  const urgencies: ("LOW" | "MEDIUM" | "HIGH" | "CRITICAL")[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "MEDIUM"];
  const types: string[] = ["VIDEO", "IN_PERSON", "VIDEO", "IN_PERSON", "PHONE"];

  return patients.map((p, i) => {
    const schedDate = new Date();
    schedDate.setHours(9 + i, (i % 2) * 30, 0, 0);

    return {
      id: `placeholder-${i}`,
      scheduledAt: schedDate.toISOString(),
      duration: 30,
      status: statusForTab[tab],
      consultationType: types[i],
      urgencyLevel: urgencies[i],
      reason: reasons[i],
      notes: null,
      patient: {
        id: `patient-${i}`,
        dateOfBirth: p.dob,
        gender: p.gender,
        bloodType: p.blood,
        allergies: p.allergies,
        user: { firstName: p.first, lastName: p.last, avatarUrl: null, email: `${p.first.toLowerCase()}@email.com`, phone: "+1 555-000-000" + i },
        vitals: [
          { id: `v-${i}`, bloodPressure: "120/80", heartRate: 72, temperature: 98.6, recordedAt: new Date().toISOString() },
        ],
        prescriptions: [
          { id: `rx-${i}`, medication: "Lisinopril 10mg", dosage: "10mg", frequency: "Once daily", isActive: true },
        ],
        medicalNotes: [
          { id: `note-${i}`, title: "Previous visit", content: "Patient presented with mild symptoms. Vitals normal.", createdAt: new Date(Date.now() - 86400000 * 7).toISOString() },
        ],
      },
    };
  });
}
