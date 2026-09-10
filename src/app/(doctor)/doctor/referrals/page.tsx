"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Send,
  Inbox,
  Search,
  User,
  Stethoscope,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────

type TabKey = "create" | "incoming";

interface DoctorOption {
  id: string;
  name: string;
  specialization: string;
}

interface PatientOption {
  id: string;
  name: string;
}

interface IncomingReferral {
  id: string;
  patientName: string;
  referringDoctorName: string;
  referringDoctorSpeciality: string;
  reason: string;
  notes: string | null;
  status: string;
  createdAt: string;
}

interface SentReferral {
  id: string;
  patientName: string;
  referredDoctorName: string;
  referredDoctorSpeciality: string;
  reason: string;
  status: string;
  createdAt: string;
}

// ─── Status helpers ──────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  PENDING: { bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
  ACCEPTED: { bg: "bg-green-100", text: "text-green-700", icon: CheckCircle },
  DECLINED: { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
};

// ─── Component ──────────────────────────────────────────

export default function DoctorReferralsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("create");
  // ─── Create Referral form state ────────────────────────
  const [specialityFilter, setSpecialityFilter] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorOption | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ─── Incoming referrals state ──────────────────────────
  const [processing, setProcessing] = useState<string | null>(null);

  // ─── Real Data State ──────────────────────────────────
  const [allDoctors, setAllDoctors] = useState<DoctorOption[]>([]);
  const [allPatients, setAllPatients] = useState<PatientOption[]>([]);
  const [incomingReferrals, setIncomingReferrals] = useState<IncomingReferral[]>([]);
  const [sentReferrals, setSentReferrals] = useState<SentReferral[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const [doctorsRes, patientsRes, referralsRes] = await Promise.all([
        fetch("/api/doctors?limit=50"),
        fetch("/api/patients?all=true&limit=50"),
        fetch("/api/referrals"),
      ]);

      if (doctorsRes.ok) {
        const dData = await doctorsRes.json();
        if (Array.isArray(dData.doctors)) {
          setAllDoctors(
            dData.doctors.map((d: { id: string; user?: { firstName?: string; lastName?: string }; specialization?: string }) => ({
              id: d.id,
              name: `Dr. ${d.user?.firstName || ""} ${d.user?.lastName || ""}`.trim(),
              specialization: d.specialization || "General Practice",
            }))
          );
        }
      }

      if (patientsRes.ok) {
        const pData = await patientsRes.json();
        if (Array.isArray(pData.patients)) {
          setAllPatients(
            pData.patients.map((p: { id: string; user?: { firstName?: string; lastName?: string } }) => ({
              id: p.id,
              name: `${p.user?.firstName || ""} ${p.user?.lastName || ""}`.trim() || "Patient",
            }))
          );
        }
      }

      if (referralsRes.ok) {
        const rData = await referralsRes.json();
        if (Array.isArray(rData.received)) {
          setIncomingReferrals(
            rData.received.map((r: { id: string; patient?: { user?: { firstName?: string; lastName?: string } }; referringDoctor?: { user?: { firstName?: string; lastName?: string }; specialization?: string }; reason: string; notes?: string | null; status: string; createdAt: string }) => ({
              id: r.id,
              patientName: `${r.patient?.user?.firstName || ""} ${r.patient?.user?.lastName || ""}`.trim() || "Patient",
              referringDoctorName: `Dr. ${r.referringDoctor?.user?.firstName || ""} ${r.referringDoctor?.user?.lastName || ""}`.trim(),
              referringDoctorSpeciality: r.referringDoctor?.specialization || "General Practice",
              reason: r.reason,
              notes: r.notes ?? null,
              status: r.status,
              createdAt: r.createdAt,
            }))
          );
        }
        if (Array.isArray(rData.sent)) {
          setSentReferrals(
            rData.sent.map((r: { id: string; patient?: { user?: { firstName?: string; lastName?: string } }; referredDoctor?: { user?: { firstName?: string; lastName?: string }; specialization?: string }; reason: string; status: string; createdAt: string }) => ({
              id: r.id,
              patientName: `${r.patient?.user?.firstName || ""} ${r.patient?.user?.lastName || ""}`.trim() || "Patient",
              referredDoctorName: `Dr. ${r.referredDoctor?.user?.firstName || ""} ${r.referredDoctor?.user?.lastName || ""}`.trim(),
              referredDoctorSpeciality: r.referredDoctor?.specialization || "General Practice",
              reason: r.reason,
              status: r.status,
              createdAt: r.createdAt,
            }))
          );
        }
      }
    } catch (err) {
      console.error("Failed to load referral data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ─── Filtered doctors ─────────────────────────────────

  const filteredDoctors = allDoctors.filter((d) => {
    const matchesSpeciality = !specialityFilter || d.specialization.toLowerCase().includes(specialityFilter.toLowerCase());
    const matchesSearch = !doctorSearch || d.name.toLowerCase().includes(doctorSearch.toLowerCase());
    return matchesSpeciality && matchesSearch;
  });

  const filteredPatients = allPatients.filter((p) =>
    !patientSearch || p.name.toLowerCase().includes(patientSearch.toLowerCase())
  );

  const specialities = Array.from(new Set(allDoctors.map((d) => d.specialization))).sort();

  // ─── Handlers ──────────────────────────────────────────

  async function handleCreateReferral() {
    if (!selectedDoctor || !selectedPatient || !reason.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          referredDoctorId: selectedDoctor.id,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create referral");
      }

      setSubmitSuccess(true);
      setSelectedDoctor(null);
      setSelectedPatient(null);
      setReason("");
      setNotes("");
      setSpecialityFilter("");
      setDoctorSearch("");
      setPatientSearch("");
      fetchData();
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create referral");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReferralAction(referralId: string, action: "ACCEPTED" | "DECLINED") {
    setProcessing(referralId);
    try {
      const res = await fetch("/api/referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralId,
          action,
        }),
      });

      if (res.ok) {
        setIncomingReferrals((prev) =>
          prev.map((r) => (r.id === referralId ? { ...r, status: action } : r))
        );
      }
    } catch (err) {
      console.error("Failed to update referral status:", err);
    } finally {
      setProcessing(null);
    }
  }

  // ─── Tabs ──────────────────────────────────────────────

  const tabs: { key: TabKey; label: string; icon: typeof Send }[] = [
    { key: "create", label: "Create Referral", icon: Send },
    { key: "incoming", label: "Incoming Referrals", icon: Inbox },
  ];

  const pendingCount = incomingReferrals.filter((r) => r.status === "PENDING").length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <Link
              href="/doctor/dashboard"
              className="text-gray-400 hover:text-gray-600"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
              <p className="text-gray-500 text-sm">
                Create and manage patient referrals
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Tab Switcher */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-8 w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition",
                  activeTab === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.key === "incoming" && pendingCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab 1: Create Referral ──────────────────── */}
        {activeTab === "create" && (
          <div className="space-y-6">
            {/* Success Message */}
            {submitSuccess && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700">
                <CheckCircle className="w-5 h-5" />
                Referral created successfully! The receiving doctor and patient have been notified.
              </div>
            )}

            {submitError && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                <AlertCircle className="w-5 h-5" />
                {submitError}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Select Receiving Doctor */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-[var(--primary)]" />
                  Select Receiving Doctor
                </h3>

                {/* Speciality Filter */}
                <div className="mb-3">
                  <select
                    value={specialityFilter}
                    onChange={(e) => setSpecialityFilter(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
                  >
                    <option value="">All Specialities</option>
                    {specialities.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Doctor search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search doctor by name..."
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                {/* Doctor List */}
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {filteredDoctors.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No doctors found
                    </p>
                  ) : (
                    filteredDoctors.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedDoctor(doc)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl text-left transition",
                          selectedDoctor?.id === doc.id
                            ? "bg-[var(--primary)]/10 border border-[var(--primary)]/30"
                            : "hover:bg-gray-50 border border-transparent"
                        )}
                      >
                        <div className="w-9 h-9 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Stethoscope className="w-4 h-4 text-[var(--primary)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {doc.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {doc.specialization}
                          </p>
                        </div>
                        {selectedDoctor?.id === doc.id && (
                          <CheckCircle className="w-4 h-4 text-[var(--primary)] flex-shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Select Patient */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-600" />
                  Select Patient
                </h3>

                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search patient by name..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {filteredPatients.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No patients found
                    </p>
                  ) : (
                    filteredPatients.map((pat) => (
                      <button
                        key={pat.id}
                        onClick={() => setSelectedPatient(pat)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl text-left transition",
                          selectedPatient?.id === pat.id
                            ? "bg-emerald-50 border border-emerald-200"
                            : "hover:bg-gray-50 border border-transparent"
                        )}
                      >
                        <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-emerald-600" />
                        </div>
                        <p className="text-sm font-medium text-gray-900 flex-1">
                          {pat.name}
                        </p>
                        {selectedPatient?.id === pat.id && (
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Reason & Notes */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-violet-600" />
                Referral Details
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Referral *
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Suspected cardiac arrhythmia requiring specialist evaluation"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional context, history, or instructions for the receiving doctor..."
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
                  />
                </div>
              </div>

              {/* Summary + Submit */}
              {selectedDoctor && selectedPatient && (
                <div className="mt-4 p-4 bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-xl">
                  <p className="text-sm text-blue-800">
                    <strong>{selectedPatient.name}</strong>{" "}
                    <ArrowRight className="w-3.5 h-3.5 inline mx-1" />{" "}
                    <strong>{selectedDoctor.name}</strong> ({selectedDoctor.specialization})
                  </p>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={handleCreateReferral}
                  disabled={submitting || !selectedDoctor || !selectedPatient || !reason.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[var(--primary)] hover:opacity-90 text-white font-medium rounded-xl transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {submitting ? "Sending..." : "Send Referral"}
                </button>
              </div>
            </div>

            {/* Sent Referrals (below the form) */}
            {sentReferrals.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">
                  Sent Referrals
                </h3>
                <div className="space-y-3">
                  {sentReferrals.map((ref) => {
                    const statusCfg = STATUS_STYLE[ref.status] || STATUS_STYLE.PENDING;
                    const StatusIcon = statusCfg.icon;
                    return (
                      <div
                        key={ref.id}
                        className="flex items-center gap-4 p-4 rounded-xl border border-gray-50 hover:bg-gray-50 transition"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium text-gray-900">
                              {ref.patientName}
                            </p>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                            <p className="text-sm text-gray-600">
                              {ref.referredDoctorName}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {ref.reason}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
                            statusCfg.bg,
                            statusCfg.text
                          )}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {ref.status}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {format(new Date(ref.createdAt), "MMM d")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Incoming Referrals ───────────────── */}
        {activeTab === "incoming" && (
          <div className="space-y-4">
            {incomingReferrals.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  No incoming referrals
                </p>
              </div>
            ) : (
              incomingReferrals.map((ref) => {
                const statusCfg = STATUS_STYLE[ref.status] || STATUS_STYLE.PENDING;
                const StatusIcon = statusCfg.icon;
                const isPending = ref.status === "PENDING";
                const isProcessing = processing === ref.id;

                return (
                  <div
                    key={ref.id}
                    className="bg-white rounded-2xl border border-gray-100 p-6"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Stethoscope className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            From: {ref.referringDoctorName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {ref.referringDoctorSpeciality} &middot;{" "}
                            {format(new Date(ref.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
                          statusCfg.bg,
                          statusCfg.text
                        )}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {ref.status}
                      </span>
                    </div>

                    <div className="ml-13 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                          Patient: <strong className="text-gray-900">{ref.patientName}</strong>
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                        <span className="text-gray-600">{ref.reason}</span>
                      </div>
                      {ref.notes && (
                        <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
                          <span className="font-medium text-gray-700">Notes: </span>
                          {ref.notes}
                        </div>
                      )}
                    </div>

                    {isPending && (
                      <div className="flex gap-3 mt-4 ml-13">
                        <button
                          onClick={() => handleReferralAction(ref.id, "ACCEPTED")}
                          disabled={isProcessing}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Accept
                        </button>
                        <button
                          onClick={() => handleReferralAction(ref.id, "DECLINED")}
                          disabled={isProcessing}
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
