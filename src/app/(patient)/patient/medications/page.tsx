"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Pill,
  Clock,
  RefreshCw,
  Loader2,
  Calendar,
  User,
  Timer,
  ChevronDown,
  ChevronUp,
  X,
  AlertCircle,
  CheckCircle,
  Info,
  Plus,
  ShieldCheck,
  Lock,
  Check,
  Activity,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import MedSafetyPanel from "@/components/amelia/MedSafetyPanel";
import AddMedicationModal, { MedicationInput } from "@/components/medications/AddMedicationModal";

// ─── Types ───────────────────────────────────────────────

interface Medication {
  id: string;
  patientId: string;
  doctorId: string | null;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  refillsAllowed: number;
  refillsUsed: number;
  isActive: boolean;
  prescribedAt: string;
  expiresAt: string | null;
  nextDoseAt: string | null;
  addedBy?: "DOCTOR" | "PATIENT" | string;
  isSharedWithDoctor?: boolean;
  usageLogs?: string[];
  last7DaysLogs?: string[];
  takenToday?: boolean;
  adherenceRate7Days?: number;
  takenDaysCount?: number;
  doctor?: {
    user: { firstName: string; lastName: string };
  } | null;
}

interface AdherenceStats {
  window?: string;
  weeklyAdherenceRate?: number;
  totalLogged7Days?: number;
  totalPrescriptions?: number;
}

type DoseStatus = "taken" | "due-soon" | "upcoming" | "missed";

interface DoseSlot {
  time: Date;
  label: string;
  status: DoseStatus;
}

// ─── Helpers ─────────────────────────────────────────────

function getDoseStatus(doseTime: Date, now: Date): DoseStatus {
  const diffMs = doseTime.getTime() - now.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  if (diffMinutes < -30) return "missed";
  if (diffMinutes <= 60) return "due-soon";
  if (doseTime < now) return "taken";
  return "upcoming";
}

function buildTodaySchedule(medications: Medication[]): DoseSlot[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const slotMap = new Map<number, DoseSlot>();

  for (const med of medications) {
    if (!med.isActive || !med.nextDoseAt) continue;

    const frequencySlots: Record<string, number[]> = {
      "Once daily": [8],
      "Twice daily": [8, 20],
      "Three times daily": [8, 14, 20],
      "Four times daily": [8, 12, 16, 20],
      "Every 4 hours": [6, 10, 14, 18, 22],
      "Every 6 hours": [6, 12, 18],
      "Every 8 hours": [8, 16],
      "Every 12 hours": [8, 20],
    };

    const hours = frequencySlots[med.frequency] ?? [8];
    for (const hour of hours) {
      if (slotMap.has(hour)) continue;
      const doseTime = new Date(today);
      doseTime.setHours(hour, 0, 0, 0);
      const status = getDoseStatus(doseTime, now);
      slotMap.set(hour, {
        time: doseTime,
        label: format(doseTime, "h:mm a"),
        status,
      });
    }
  }

  return Array.from(slotMap.values()).sort(
    (a, b) => a.time.getTime() - b.time.getTime()
  );
}

function getNextDoseLabel(nextDoseAt: string | null): {
  text: string;
  isOverdue: boolean;
} {
  if (!nextDoseAt) return { text: "No schedule", isOverdue: false };

  const doseTime = new Date(nextDoseAt);
  const now = new Date();

  if (doseTime < now) {
    return { text: "Overdue", isOverdue: true };
  }

  return {
    text: `Due ${formatDistanceToNow(doseTime, { addSuffix: true })}`,
    isOverdue: false,
  };
}

function getFallback7Days(): string[] {
  const now = new Date();
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

const DOSE_STATUS_STYLES: Record<DoseStatus, string> = {
  taken: "bg-emerald-500",
  "due-soon": "bg-amber-500",
  upcoming: "bg-gray-300",
  missed: "bg-red-500",
};

const DOSE_STATUS_RING: Record<DoseStatus, string> = {
  taken: "ring-emerald-200",
  "due-soon": "ring-amber-200 animate-pulse",
  upcoming: "ring-gray-100",
  missed: "ring-red-200",
};

// ─── Component ──────────────────────────────────────────

export default function PatientMedicationsPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [last7Days, setLast7Days] = useState<string[]>(getFallback7Days());
  const [todayStr, setTodayStr] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [adherenceStats, setAdherenceStats] = useState<AdherenceStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter: all | doctor | self
  const [filter, setFilter] = useState<"all" | "doctor" | "self">("all");

  // Selection & UI state
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Loading indicators for micro-actions
  const [refillLoadingId, setRefillLoadingId] = useState<string | null>(null);
  const [loggingActionKey, setLoggingActionKey] = useState<string | null>(null);
  const [togglingPrivacyId, setTogglingPrivacyId] = useState<string | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Auto-clear toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Fetch medications & adherence
  const fetchMedications = useCallback(async () => {
    try {
      const res = await fetch("/api/medications");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setMedications(data);
        } else if (data && typeof data === "object") {
          setMedications(Array.isArray(data.medications) ? data.medications : []);
          if (Array.isArray(data.last7Days)) setLast7Days(data.last7Days);
          if (data.today) setTodayStr(data.today);
          if (data.adherenceStats) setAdherenceStats(data.adherenceStats);
        }
      }
    } catch (err) {
      console.error("Failed to fetch medications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedications();
  }, [fetchMedications]);

  // 1-Click Log / Toggle Usage
  const handleToggleUsage = async (medicationId: string, date?: string) => {
    const targetDate = date || todayStr;
    const actionKey = `${medicationId}-${targetDate}`;
    setLoggingActionKey(actionKey);

    try {
      const res = await fetch(`/api/medications/${medicationId}/usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: targetDate }),
      });

      if (res.ok) {
        const data = await res.json();
        setToast({
          message:
            data.action === "LOGGED"
              ? `Dose recorded as taken for ${targetDate === todayStr ? "today" : targetDate}!`
              : `Dose unlogged for ${targetDate === todayStr ? "today" : targetDate}`,
          type: "success",
        });
        await fetchMedications();
      } else {
        const err = await res.json();
        setToast({
          message: err.error || "Failed to update dose log",
          type: "error",
        });
      }
    } catch {
      setToast({ message: "Network error. Please try again.", type: "error" });
    } finally {
      setLoggingActionKey(null);
    }
  };

  // Toggle Doctor Sharing Privacy
  const handleTogglePrivacy = async (
    medicationId: string,
    currentShared: boolean,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    setTogglingPrivacyId(medicationId);

    try {
      const res = await fetch(`/api/medications/${medicationId}/privacy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSharedWithDoctor: !currentShared }),
      });

      if (res.ok) {
        setToast({
          message: !currentShared
            ? "Medication is now shared with your doctor"
            : "Medication is now private (hidden from doctor)",
          type: "success",
        });
        await fetchMedications();
      } else {
        const err = await res.json();
        setToast({
          message: err.error || "Failed to update privacy setting",
          type: "error",
        });
      }
    } catch {
      setToast({ message: "Network error. Please try again.", type: "error" });
    } finally {
      setTogglingPrivacyId(null);
    }
  };

  // Add Personal Medication
  const handleAddMedication = async (data: MedicationInput) => {
    try {
      const res = await fetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medication: data.name,
          dosage: data.dosage,
          frequency: data.frequency,
          duration: "Ongoing",
          instructions: data.instructions || undefined,
          isSharedWithDoctor: data.isSharedWithDoctor ?? true,
        }),
      });

      if (res.ok) {
        setToast({
          message: "Medication added to your schedule successfully",
          type: "success",
        });
        await fetchMedications();
      } else {
        const err = await res.json();
        setToast({
          message: err.error || "Failed to add medication",
          type: "error",
        });
      }
    } catch {
      setToast({ message: "Network error. Please try again.", type: "error" });
    }
  };

  // Request Refill
  const handleRefill = async (medicationId: string) => {
    setRefillLoadingId(medicationId);
    try {
      const res = await fetch(`/api/medications/${medicationId}/refill`, {
        method: "PATCH",
      });
      if (res.ok) {
        setToast({ message: "Refill request sent successfully", type: "success" });
        await fetchMedications();
      } else {
        const data = await res.json();
        setToast({
          message: data.error || "Failed to request refill",
          type: "error",
        });
      }
    } catch {
      setToast({ message: "Network error. Please try again.", type: "error" });
    } finally {
      setRefillLoadingId(null);
    }
  };

  const activeMedications = useMemo(
    () => medications.filter((m) => m.isActive),
    [medications]
  );

  const filteredActiveMedications = useMemo(() => {
    if (filter === "doctor") {
      return activeMedications.filter((m) => (m.addedBy ?? "DOCTOR") === "DOCTOR");
    }
    if (filter === "self") {
      return activeMedications.filter((m) => m.addedBy === "PATIENT");
    }
    return activeMedications;
  }, [activeMedications, filter]);

  const inactiveMedications = useMemo(
    () => medications.filter((m) => !m.isActive),
    [medications]
  );

  const schedule = useMemo(
    () => buildTodaySchedule(medications),
    [medications]
  );

  // Adherence rate calculations
  const weeklyRate = adherenceStats?.weeklyAdherenceRate ?? 0;
  const dosesTakenCount = adherenceStats?.totalLogged7Days ?? 0;

  // ─── Loading State ──────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/patient/dashboard"
                className="text-gray-400 hover:text-gray-600"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  My Medications & Adherence
                </h1>
                <p className="text-gray-500 text-sm">
                  Daily tracking, dose logging, and prescription management
                </p>
              </div>
            </div>
          </div>
        </header>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-7 w-16 bg-gray-200 rounded-lg" />
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-5 w-48 bg-gray-200 rounded" />
                    <div className="h-4 w-32 bg-gray-100 rounded" />
                  </div>
                  <div className="h-9 w-28 bg-gray-200 rounded-xl" />
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Render ────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2">
          <div
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium",
              toast.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white"
            )}
          >
            {toast.type === "success" ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {toast.message}
            <button
              onClick={() => setToast(null)}
              className="ml-2 hover:opacity-80"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/patient/dashboard"
              className="text-gray-400 hover:text-gray-600"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                My Medications & Adherence
              </h1>
              <p className="text-gray-500 text-sm">
                Log daily doses, track adherence, and manage personal prescriptions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] hover:opacity-90 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Medication
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <MedSafetyPanel />

        {/* ────────────────────────────────────────────────── */}
        {/* Strict 7-Day Adherence Tracker Hero Card           */}
        {/* ────────────────────────────────────────────────── */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8 overflow-hidden relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Left: Weekly Score */}
            <div className="flex items-center gap-5">
              <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={cn(
                      weeklyRate >= 80
                        ? "text-emerald-500"
                        : weeklyRate >= 50
                        ? "text-amber-500"
                        : "text-blue-500"
                    )}
                    strokeDasharray={`${weeklyRate}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-bold text-gray-900 leading-none">
                    {weeklyRate}%
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium mt-0.5">
                    Adherence
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Last 7 Days Progression
                  </span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 mt-1">
                  7-Day Adherence Overview
                </h2>
                <p className="text-xs text-gray-500">
                  {dosesTakenCount} dose(s) logged across {activeMedications.length} active medication(s).
                  Logged entries update your doctor&apos;s chart in real time.
                </p>
              </div>
            </div>

            {/* Right: 7-Day Interactive Strip */}
            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 flex items-center justify-between sm:justify-start sm:gap-3 overflow-x-auto">
              {last7Days.map((dateStr) => {
                const isTodayDate = dateStr === todayStr;
                const d = parseISO(dateStr);
                const dayName = format(d, "EEE");
                const dayNum = format(d, "d");

                // Check how many active meds were logged on this date
                const loggedCountForDay = activeMedications.filter((m) =>
                  (m.usageLogs || []).some((log) => {
                    const lDate = log.includes("T") ? log.split("T")[0] : log;
                    return lDate === dateStr;
                  })
                ).length;

                const hasFullDoses =
                  activeMedications.length > 0 &&
                  loggedCountForDay >= activeMedications.length;
                const hasPartialDoses =
                  loggedCountForDay > 0 &&
                  loggedCountForDay < activeMedications.length;

                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "flex flex-col items-center p-2 rounded-xl min-w-[50px] transition-all",
                      isTodayDate
                        ? "bg-white shadow-sm border border-[var(--primary)]/30"
                        : "hover:bg-white/60"
                    )}
                  >
                    <span
                      className={cn(
                        "text-[10px] uppercase font-bold tracking-wider",
                        isTodayDate ? "text-[var(--primary)]" : "text-gray-400"
                      )}
                    >
                      {isTodayDate ? "Today" : dayName}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-bold my-1",
                        isTodayDate ? "text-gray-900" : "text-gray-700"
                      )}
                    >
                      {dayNum}
                    </span>

                    <div
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px]",
                        hasFullDoses
                          ? "bg-emerald-500 text-white"
                          : hasPartialDoses
                          ? "bg-amber-400 text-white"
                          : isTodayDate
                          ? "bg-gray-200 text-gray-500 ring-2 ring-amber-300"
                          : "bg-gray-100 text-gray-300"
                      )}
                      title={`${loggedCountForDay}/${activeMedications.length} taken`}
                    >
                      {hasFullDoses ? (
                        <Check className="w-3 h-3 stroke-[3]" />
                      ) : hasPartialDoses ? (
                        <span>{loggedCountForDay}</span>
                      ) : (
                        <span>&middot;</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ────────────────────────────────────────────────── */}
        {/* Section 1: Medication Schedule (Today's Doses)     */}
        {/* ────────────────────────────────────────────────── */}
        {schedule.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Today&apos;s Scheduled Time Slots
            </h2>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="relative flex items-center justify-between">
                {/* Connecting line */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-100 -translate-y-1/2" />

                {schedule.map((slot, idx) => (
                  <div
                    key={idx}
                    className="relative flex flex-col items-center gap-2 z-10"
                  >
                    <span className="text-xs text-gray-500 font-medium">
                      {slot.label}
                    </span>
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full ring-4",
                        DOSE_STATUS_STYLES[slot.status],
                        DOSE_STATUS_RING[slot.status]
                      )}
                    />
                    <span
                      className={cn(
                        "text-[10px] font-medium capitalize",
                        slot.status === "taken" && "text-emerald-600",
                        slot.status === "due-soon" && "text-amber-600",
                        slot.status === "upcoming" && "text-gray-400",
                        slot.status === "missed" && "text-red-600"
                      )}
                    >
                      {slot.status === "due-soon" ? "Due soon" : slot.status}
                    </span>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-5 pt-4 border-t border-gray-50">
                {(
                  [
                    ["taken", "Taken", "bg-emerald-500"],
                    ["due-soon", "Due soon", "bg-amber-500"],
                    ["upcoming", "Upcoming", "bg-gray-300"],
                    ["missed", "Missed", "bg-red-500"],
                  ] as const
                ).map(([, label, color]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
                    <span className="text-xs text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ────────────────────────────────────────────────── */}
        {/* Section 2: Active Medications & Daily Dose Logging */}
        {/* ────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Active Medications & Logs
              </h2>
              <span className="px-2.5 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-medium rounded-full">
                {activeMedications.length}
              </span>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold text-gray-600">
              <button
                onClick={() => setFilter("all")}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all",
                  filter === "all" ? "bg-white text-gray-900 shadow-sm" : "hover:text-gray-900"
                )}
              >
                All ({activeMedications.length})
              </button>
              <button
                onClick={() => setFilter("doctor")}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all",
                  filter === "doctor" ? "bg-white text-gray-900 shadow-sm" : "hover:text-gray-900"
                )}
              >
                Doctor Prescribed (
                {activeMedications.filter((m) => (m.addedBy ?? "DOCTOR") === "DOCTOR").length}
                )
              </button>
              <button
                onClick={() => setFilter("self")}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all",
                  filter === "self" ? "bg-white text-gray-900 shadow-sm" : "hover:text-gray-900"
                )}
              >
                Personal & Supplements (
                {activeMedications.filter((m) => m.addedBy === "PATIENT").length}
                )
              </button>
            </div>
          </div>

          {filteredActiveMedications.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center shadow-sm">
              <Pill className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-700 font-semibold text-base mb-1">
                {filter === "all"
                  ? "No medications scheduled yet"
                  : filter === "doctor"
                  ? "No doctor-prescribed medications found"
                  : "No personal medications added"}
              </p>
              <p className="text-gray-400 text-sm max-w-md mx-auto mb-5">
                {filter === "self"
                  ? "Track your over-the-counter vitamins or supplements by adding one now."
                  : "You can track your own vitamins, supplements, or view prescriptions as soon as your doctor assigns them."}
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] hover:opacity-90 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Medication Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filteredActiveMedications.map((med) => {
                const doseInfo = getNextDoseLabel(med.nextDoseAt);
                const refillsRemaining = med.refillsAllowed - med.refillsUsed;
                const refillProgress =
                  med.refillsAllowed > 0
                    ? (med.refillsUsed / med.refillsAllowed) * 100
                    : 0;

                const isPatientAdded = med.addedBy === "PATIENT";
                const isShared = med.isSharedWithDoctor ?? true;

                // Daily taken state
                const logs = med.usageLogs || [];
                const isTakenToday = logs.some((l) => {
                  const d = l.includes("T") ? l.split("T")[0] : l;
                  return d === todayStr;
                });

                const todayActionKey = `${med.id}-${todayStr}`;
                const isActionLoading = loggingActionKey === todayActionKey;
                const isPrivacyLoading = togglingPrivacyId === med.id;

                return (
                  <div
                    key={med.id}
                    onClick={() => setSelectedMedication(med)}
                    className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-[var(--primary)]/30 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges Row */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isPatientAdded ? (
                            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Personal
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg flex items-center gap-1">
                              <User className="w-3 h-3" /> Doctor Prescribed
                            </span>
                          )}

                          {/* Privacy Badge / Toggle for Patient Added Meds */}
                          {isPatientAdded && (
                            <button
                              type="button"
                              onClick={(e) => handleTogglePrivacy(med.id, isShared, e)}
                              disabled={isPrivacyLoading}
                              title="Click to toggle doctor privacy"
                              className={cn(
                                "px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all",
                                isShared
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                              )}
                            >
                              {isPrivacyLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : isShared ? (
                                <>
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Shared with Doctor</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Private to Me</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 flex-shrink-0" />
                      </div>

                      {/* Header row */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl font-bold text-gray-900">
                            {med.medication}
                          </h3>
                          <span className="px-2.5 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold rounded-full">
                            {med.dosage}
                          </span>
                        </div>
                      </div>

                      {/* Frequency + Duration */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {med.frequency}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {med.duration}
                        </span>
                        {med.instructions && (
                          <span className="text-gray-400 italic">
                            &quot;{med.instructions}&quot;
                          </span>
                        )}
                      </div>

                      {/* Doctor attribution if prescribed */}
                      {med.doctor?.user && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
                          <User className="w-3.5 h-3.5" />
                          <span>
                            Dr. {med.doctor.user.firstName} {med.doctor.user.lastName} &middot;{" "}
                            {format(new Date(med.prescribedAt), "MMM d, yyyy")}
                          </span>
                        </div>
                      )}

                      {/* ────────────────────────────────────────── */}
                      {/* Strict Last 7 Days Mini Tracker Dots Strip */}
                      {/* ────────────────────────────────────────── */}
                      <div className="my-4 p-3 bg-gray-50/80 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-2">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" /> Last 7 Days Log
                          </span>
                          <span className="text-[11px] text-gray-400 font-normal">
                            Tap day to toggle
                          </span>
                        </div>

                        <div className="grid grid-cols-7 gap-1.5">
                          {last7Days.map((dStr) => {
                            const isTodayCol = dStr === todayStr;
                            const dObj = parseISO(dStr);
                            const dayLetter = format(dObj, "EEEEE"); // M, T, W...
                            const isTaken = logs.some((l) => {
                              const s = l.includes("T") ? l.split("T")[0] : l;
                              return s === dStr;
                            });

                            const isDotLoading = loggingActionKey === `${med.id}-${dStr}`;

                            return (
                              <button
                                key={dStr}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleUsage(med.id, dStr);
                                }}
                                disabled={isDotLoading}
                                title={`${dStr}: ${isTaken ? "Taken (click to unlog)" : "Not taken (click to log)"}`}
                                className={cn(
                                  "flex flex-col items-center justify-center py-1.5 rounded-xl text-center transition-all",
                                  isTodayCol ? "bg-white shadow-xs ring-1 ring-[var(--primary)]/30" : "hover:bg-white",
                                  isTaken
                                    ? "text-emerald-700 font-bold"
                                    : "text-gray-400 font-medium"
                                )}
                              >
                                <span className="text-[10px] text-gray-400 leading-tight">
                                  {dayLetter}
                                </span>
                                <div
                                  className={cn(
                                    "w-5 h-5 rounded-full mt-1 flex items-center justify-center text-[10px] transition-all",
                                    isTaken
                                      ? "bg-emerald-500 text-white shadow-xs"
                                      : isTodayCol
                                      ? "bg-amber-100 text-amber-700 ring-2 ring-amber-300"
                                      : "bg-gray-200 text-gray-400"
                                  )}
                                >
                                  {isDotLoading ? (
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  ) : isTaken ? (
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  ) : (
                                    <span className="text-[8px]">&bull;</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Next dose countdown */}
                      <div
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-xl mb-4 text-xs font-semibold",
                          doseInfo.isOverdue
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-[var(--primary)]/10 text-[var(--primary)]"
                        )}
                      >
                        <Timer className="w-4 h-4" />
                        {doseInfo.text}
                      </div>

                      {/* Refills (if prescribed by doctor) */}
                      {!isPatientAdded && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                            <span>Refills remaining</span>
                            <span className="font-semibold text-gray-700">
                              {refillsRemaining} / {med.refillsAllowed}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                refillsRemaining === 0
                                  ? "bg-red-400"
                                  : refillsRemaining <= 1
                                  ? "bg-amber-400"
                                  : "bg-emerald-400"
                              )}
                              style={{ width: `${Math.max(0, 100 - refillProgress)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Row: 1-Click Log Dose & Refill Request */}
                    <div className="pt-2 border-t border-gray-50 space-y-2">
                      {/* Primary 1-Click Daily Action */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleUsage(med.id, todayStr);
                        }}
                        disabled={isActionLoading}
                        className={cn(
                          "w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm",
                          isTakenToday
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-[var(--primary)] hover:opacity-90 text-white"
                        )}
                      >
                        {isActionLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Updating...
                          </>
                        ) : isTakenToday ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Taken Today (Click to toggle)
                          </>
                        ) : (
                          <>
                            <Pill className="w-4 h-4" />
                            Mark as Taken Today
                          </>
                        )}
                      </button>

                      {/* Secondary actions (refill & pharmacy) */}
                      {!isPatientAdded && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRefill(med.id);
                            }}
                            disabled={refillsRemaining <= 0 || refillLoadingId === med.id}
                            className={cn(
                              "inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all",
                              refillsRemaining <= 0
                                ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                            )}
                          >
                            {refillLoadingId === med.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                            )}
                            Refill
                          </button>

                          <Link
                            href="/patient/pharmacy"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--primary)] bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 rounded-xl transition-all"
                          >
                            Pharmacy &rarr;
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ────────────────────────────────────────────────── */}
        {/* Section 3: Inactive / Past Prescriptions            */}
        {/* ────────────────────────────────────────────────── */}
        {inactiveMedications.length > 0 && (
          <section className="space-y-4">
            <button
              onClick={() => setShowInactive((prev) => !prev)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition"
            >
              Past / Completed Medications
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full normal-case">
                {inactiveMedications.length}
              </span>
              {showInactive ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showInactive && (
              <div className="bg-white rounded-3xl border border-gray-100 divide-y divide-gray-50 overflow-hidden shadow-sm">
                {inactiveMedications.map((med) => (
                  <div
                    key={med.id}
                    onClick={() => setSelectedMedication(med)}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Pill className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          {med.medication}
                          <span className="ml-2 text-gray-400 font-normal">
                            {med.dosage}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400">
                          {med.addedBy === "PATIENT"
                            ? "Self-reported"
                            : `Prescribed by Dr. ${med.doctor?.user?.firstName || ""} ${med.doctor?.user?.lastName || ""}`}{" "}
                          &middot; {format(new Date(med.prescribedAt), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <Info className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ────────────────────────────────────────────────── */}
      {/* Slide-In Medication Detail Drawer                  */}
      {/* ────────────────────────────────────────────────── */}
      {selectedMedication && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40 transition-opacity"
          onClick={() => setSelectedMedication(null)}
        />
      )}

      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto",
          selectedMedication ? "translate-x-0" : "translate-x-full"
        )}
      >
        {selectedMedication && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                Medication Details
              </h2>
              <button
                onClick={() => setSelectedMedication(null)}
                className="p-2 hover:bg-gray-100 rounded-xl transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Name & status */}
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    selectedMedication.isActive
                      ? "bg-[var(--primary)]/10"
                      : "bg-gray-100"
                  )}
                >
                  <Pill
                    className={cn(
                      "w-6 h-6",
                      selectedMedication.isActive
                        ? "text-[var(--primary)]"
                        : "text-gray-400"
                    )}
                  />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {selectedMedication.medication}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        "inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full",
                        selectedMedication.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {selectedMedication.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                      {selectedMedication.addedBy === "PATIENT"
                        ? "Self-Reported"
                        : "Doctor Prescribed"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Privacy Setting Card */}
              {selectedMedication.addedBy === "PATIENT" && (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {selectedMedication.isSharedWithDoctor ? (
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Lock className="w-5 h-5 text-amber-600" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {selectedMedication.isSharedWithDoctor
                          ? "Shared with Doctor"
                          : "Private Medication"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedMedication.isSharedWithDoctor
                          ? "Your doctor can see this drug in your 6-month chart."
                          : "Strictly hidden from doctor and provider views."}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      handleTogglePrivacy(
                        selectedMedication.id,
                        selectedMedication.isSharedWithDoctor ?? true
                      )
                    }
                    className="text-xs font-bold text-[var(--primary)] hover:underline"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Prescription details */}
              <div className="space-y-4">
                <DetailRow label="Dosage" value={selectedMedication.dosage} />
                <DetailRow label="Frequency" value={selectedMedication.frequency} />
                <DetailRow label="Duration" value={selectedMedication.duration} />
                {selectedMedication.instructions && (
                  <DetailRow
                    label="Instructions"
                    value={selectedMedication.instructions}
                  />
                )}
              </div>

              {/* Prescribing Doctor info */}
              {selectedMedication.doctor?.user && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Prescribing Doctor
                  </h4>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-[var(--primary)]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        Dr. {selectedMedication.doctor.user.firstName}{" "}
                        {selectedMedication.doctor.user.lastName}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Refills info */}
              {selectedMedication.addedBy !== "PATIENT" && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Refill Status
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-400 text-xs">Allowed</span>
                      <p className="text-gray-900 font-bold">
                        {selectedMedication.refillsAllowed}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs">Used</span>
                      <p className="text-gray-900 font-bold">
                        {selectedMedication.refillsUsed}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3 text-sm">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Timeline
                </h4>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Prescribed / Added</span>
                  <span className="text-gray-900 font-medium">
                    {format(
                      new Date(selectedMedication.prescribedAt),
                      "MMMM d, yyyy"
                    )}
                  </span>
                </div>
                {selectedMedication.nextDoseAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Next Scheduled Dose</span>
                    <span className="text-gray-900 font-medium">
                      {format(
                        new Date(selectedMedication.nextDoseAt),
                        "MMM d, h:mm a"
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setSelectedMedication(null)}
                className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Medication Modal */}
      <AddMedicationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddMedication}
      />
    </div>
  );
}

// ─── Detail Row Sub-component ────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
        {label}
      </dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}
