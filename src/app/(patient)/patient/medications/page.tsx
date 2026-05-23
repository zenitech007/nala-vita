"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

// ─── Types ───────────────────────────────────────────────

interface Medication {
  id: string;
  patientId: string;
  doctorId: string;
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
  doctor: {
    user: { firstName: string; lastName: string };
  };
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
  if (diffMinutes < 0) return "due-soon";
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
  const [loading, setLoading] = useState(true);
  const [selectedMedication, setSelectedMedication] =
    useState<Medication | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [refillLoadingId, setRefillLoadingId] = useState<string | null>(null);
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

  const fetchMedications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/medications");
      if (res.ok) {
        const data = await res.json();
        setMedications(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedications();
  }, [fetchMedications]);

  const handleRefill = async (medicationId: string) => {
    setRefillLoadingId(medicationId);
    try {
      const res = await fetch(`/api/medications/${medicationId}/refill`, {
        method: "PATCH",
      });
      if (res.ok) {
        setToast({ message: "Refill request sent successfully", type: "success" });
        fetchMedications();
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

  const activeMedications = medications.filter((m) => m.isActive);
  const inactiveMedications = medications.filter((m) => !m.isActive);
  const schedule = buildTodaySchedule(medications);

  // ─── Loading State ──────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            <div className="flex items-center gap-3">
              <Link
                href="/patient/dashboard"
                className="text-gray-400 hover:text-gray-600"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  My Medications
                </h1>
                <p className="text-gray-500 text-sm">
                  Manage your prescriptions and refills
                </p>
              </div>
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
        </div>
      </div>
    );
  }

  // ─── Empty State ────────────────────────────────────────

  if (medications.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            <div className="flex items-center gap-3">
              <Link
                href="/patient/dashboard"
                className="text-gray-400 hover:text-gray-600"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  My Medications
                </h1>
                <p className="text-gray-500 text-sm">
                  Manage your prescriptions and refills
                </p>
              </div>
            </div>
          </div>
        </header>
        <div className="text-center py-20">
          <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-1">No medications found</p>
          <p className="text-gray-400 text-sm">
            Your prescriptions will appear here once your doctor adds them.
          </p>
        </div>
      </div>
    );
  }

  // ─── Main Render ────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <Link
              href="/patient/dashboard"
              className="text-gray-400 hover:text-gray-600"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                My Medications
              </h1>
              <p className="text-gray-500 text-sm">
                Manage your prescriptions and refills
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* ────────────────────────────────────────────────── */}
        {/* Section 1: Medication Schedule (Today's Doses)     */}
        {/* ────────────────────────────────────────────────── */}

        {schedule.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Today&apos;s Schedule
            </h2>
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
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
        {/* Section 2: Active Medications                       */}
        {/* ────────────────────────────────────────────────── */}

        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Active Medications
            </h2>
            <span className="px-2.5 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-medium rounded-full">
              {activeMedications.length}
            </span>
          </div>

          {activeMedications.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Pill className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">
                No active medications at the moment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeMedications.map((med) => {
                const doseInfo = getNextDoseLabel(med.nextDoseAt);
                const refillsRemaining = med.refillsAllowed - med.refillsUsed;
                const refillProgress =
                  med.refillsAllowed > 0
                    ? (med.refillsUsed / med.refillsAllowed) * 100
                    : 0;

                return (
                  <div
                    key={med.id}
                    onClick={() => setSelectedMedication(med)}
                    className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:border-[var(--primary)]/40 transition-all cursor-pointer"
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          {med.medication}
                        </h3>
                        <span className="px-2 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-semibold rounded-full">
                          {med.dosage}
                        </span>
                      </div>
                      <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                    </div>

                    {/* Frequency + Duration */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mb-3">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {med.frequency}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {med.duration}
                      </span>
                    </div>

                    {/* Prescribed by */}
                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-4">
                      <User className="w-3 h-3" />
                      <span>
                        Prescribed by Dr. {med.doctor.user.firstName}{" "}
                        {med.doctor.user.lastName} on{" "}
                        {format(new Date(med.prescribedAt), "MMM d, yyyy")}
                      </span>
                    </div>

                    {/* Next dose countdown */}
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-sm font-medium",
                        doseInfo.isOverdue
                          ? "bg-red-50 text-red-700"
                          : "bg-[var(--primary)]/10 text-[var(--primary)]"
                      )}
                    >
                      <Timer className="w-4 h-4" />
                      {doseInfo.text}
                    </div>

                    {/* Refills */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                        <span>Refills remaining</span>
                        <span className="font-medium text-gray-700">
                          {refillsRemaining} / {med.refillsAllowed}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            refillsRemaining === 0
                              ? "bg-red-400"
                              : refillsRemaining <= 1
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                          )}
                          style={{ width: `${100 - refillProgress}%` }}
                        />
                      </div>
                    </div>

                    {/* Refill button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRefill(med.id);
                      }}
                      disabled={
                        refillsRemaining <= 0 || refillLoadingId === med.id
                      }
                      className={cn(
                        "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition",
                        refillsRemaining <= 0
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-[var(--primary)] hover:opacity-90 text-white"
                      )}
                    >
                      {refillLoadingId === med.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Requesting...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          {refillsRemaining <= 0
                            ? "No Refills Left"
                            : "Request Refill"}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ────────────────────────────────────────────────── */}
        {/* Section 3: Inactive / Expired Medications           */}
        {/* ────────────────────────────────────────────────── */}

        {inactiveMedications.length > 0 && (
          <section className="mb-8">
            <button
              onClick={() => setShowInactive((prev) => !prev)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 hover:text-gray-700 transition"
            >
              Past Medications
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
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {inactiveMedications.map((med) => (
                  <div
                    key={med.id}
                    onClick={() => setSelectedMedication(med)}
                    className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Pill className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          {med.medication}
                          <span className="ml-2 text-gray-400 font-normal">
                            {med.dosage}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400">
                          Dr. {med.doctor.user.firstName}{" "}
                          {med.doctor.user.lastName} &middot;{" "}
                          {format(new Date(med.prescribedAt), "MMM d, yyyy")}
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
      {/* Section 4: Drug Information Panel (Slide-in)       */}
      {/* ────────────────────────────────────────────────── */}

      {/* Backdrop */}
      {selectedMedication && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
          onClick={() => setSelectedMedication(null)}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto",
          selectedMedication ? "translate-x-0" : "translate-x-full"
        )}
      >
        {selectedMedication && (
          <div className="flex flex-col h-full">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                Medication Details
              </h2>
              <button
                onClick={() => setSelectedMedication(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Medication name + status */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center",
                      selectedMedication.isActive
                        ? "bg-[var(--primary)]/10"
                        : "bg-gray-100"
                    )}
                  >
                    <Pill
                      className={cn(
                        "w-5 h-5",
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
                    <span
                      className={cn(
                        "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                        selectedMedication.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {selectedMedication.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Prescription details */}
              <div className="space-y-4">
                <DetailRow label="Dosage" value={selectedMedication.dosage} />
                <DetailRow
                  label="Frequency"
                  value={selectedMedication.frequency}
                />
                <DetailRow
                  label="Duration"
                  value={selectedMedication.duration}
                />
                {selectedMedication.instructions && (
                  <DetailRow
                    label="Instructions"
                    value={selectedMedication.instructions}
                  />
                )}
              </div>

              {/* Refill info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Refill Information
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400 text-xs">Allowed</span>
                    <p className="text-gray-900 font-medium">
                      {selectedMedication.refillsAllowed}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Used</span>
                    <p className="text-gray-900 font-medium">
                      {selectedMedication.refillsUsed}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 text-xs">Remaining</span>
                    <p className="text-gray-900 font-semibold">
                      {selectedMedication.refillsAllowed -
                        selectedMedication.refillsUsed}
                    </p>
                  </div>
                </div>
              </div>

              {/* Doctor info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Prescribing Doctor
                </h4>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-[var(--primary)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Dr. {selectedMedication.doctor.user.firstName}{" "}
                      {selectedMedication.doctor.user.lastName}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Dates
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Prescribed</span>
                    <span className="text-gray-900 font-medium">
                      {format(
                        new Date(selectedMedication.prescribedAt),
                        "MMMM d, yyyy"
                      )}
                    </span>
                  </div>
                  {selectedMedication.expiresAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Expires</span>
                      <span className="text-gray-900 font-medium">
                        {format(
                          new Date(selectedMedication.expiresAt),
                          "MMMM d, yyyy"
                        )}
                      </span>
                    </div>
                  )}
                  {selectedMedication.nextDoseAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Next dose</span>
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
            </div>

            {/* Panel footer */}
            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setSelectedMedication(null)}
                className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detail Row Sub-component ────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">
        {label}
      </dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  );
}
