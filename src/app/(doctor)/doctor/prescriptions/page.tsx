"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Search,
  User,
  Pill,
  AlertTriangle,
  Loader2,
  CheckCircle,
  ShieldAlert,
  Clock,
  Activity,
  ShieldCheck,
  CalendarDays,
  Calendar,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, parseISO } from "date-fns";

// ─── Types ───────────────────────────────────────────────

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  allergies: string[];
}

interface DrugEntry {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  refillsAllowed: number;
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: "mild" | "moderate" | "severe";
  description: string;
}

interface DoctorMedicationView {
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
  addedBy: "DOCTOR" | "PATIENT" | string;
  isSharedWithDoctor: boolean;
  usageLogs: string[];
  adherenceRate: number;
  totalLoggedDoses: number;
  daysTracked: number;
  doctor?: {
    user: { firstName: string; lastName: string };
  } | null;
}

interface AdherenceStats {
  window: string;
  overallAdherenceRate: number;
  totalLoggedDoses: number;
  activeMedicationsCount: number;
}

// ─── Constants ───────────────────────────────────────────

const FREQUENCY_OPTIONS = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "Every 4 hours",
  "Every 6 hours",
  "Every 8 hours",
  "Every 12 hours",
  "Once weekly",
  "As needed",
];

const DURATION_OPTIONS = [
  "3 days",
  "5 days",
  "7 days",
  "10 days",
  "14 days",
  "21 days",
  "30 days",
  "60 days",
  "90 days",
  "Ongoing",
];

const COMMON_DRUGS = [
  "Amoxicillin",
  "Lisinopril",
  "Metformin",
  "Atorvastatin",
  "Omeprazole",
  "Amlodipine",
  "Losartan",
  "Gabapentin",
  "Sertraline",
  "Metoprolol",
  "Prednisone",
  "Ibuprofen",
  "Acetaminophen",
  "Azithromycin",
  "Hydrochlorothiazide",
];

export default function DoctorPrescriptionsPage() {
  // Navigation tabs: adherence | prescribe
  const [activeTab, setActiveTab] = useState<"adherence" | "prescribe">("adherence");

  // Patient selection (shared across both tabs)
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);

  // ─── Tab 1: Adherence Tracking (6 Months) State ──────────
  const [patientMedications, setPatientMedications] = useState<DoctorMedicationView[]>([]);
  const [adherenceStats, setAdherenceStats] = useState<AdherenceStats | null>(null);
  const [loadingAdherence, setLoadingAdherence] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // ─── Tab 2: Write Prescription State ────────────────────
  const [drugs, setDrugs] = useState<DrugEntry[]>([]);
  const [drugInteractions, setDrugInteractions] = useState<DrugInteraction[]>([]);
  const [showDrugForm, setShowDrugForm] = useState(false);
  const [newDrug, setNewDrug] = useState<DrugEntry>({
    id: "",
    medication: "",
    dosage: "",
    frequency: "Once daily",
    duration: "7 days",
    instructions: "",
    refillsAllowed: 0,
  });
  const [drugSuggestions, setDrugSuggestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [expiryDays, setExpiryDays] = useState(30);
  const [checkingSafety, setCheckingSafety] = useState(false);
  const [allergyAlerts, setAllergyAlerts] = useState<
    { medication: string; allergy: string; note: string }[]
  >([]);

  // ─── Load Doctor's Patients ─────────────────────────────
  useEffect(() => {
    async function loadPatients() {
      try {
        const res = await fetch("/api/patients?all=true&limit=50");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.patients)) {
            const mapped = data.patients.map(
              (p: {
                id: string;
                user?: { firstName?: string; lastName?: string };
                dateOfBirth: string;
                allergies?: string[];
              }) => ({
                id: p.id,
                firstName: p.user?.firstName || "Patient",
                lastName: p.user?.lastName || "",
                dateOfBirth: p.dateOfBirth,
                allergies: p.allergies || [],
              })
            );
            setPatients(mapped);
            // Default select the first patient if available
            if (mapped.length > 0 && !selectedPatient) {
              setSelectedPatient(mapped[0]);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch patients:", err);
      } finally {
        setLoadingPatients(false);
      }
    }
    loadPatients();
  }, []);

  const filteredPatients = patients.filter((p) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(patientSearch.toLowerCase())
  );

  // ─── Fetch 6-Month Adherence Data for Selected Patient ──
  const fetchAdherenceData = useCallback(async (patientId: string) => {
    setLoadingAdherence(true);
    try {
      const res = await fetch(`/api/medications?patientId=${encodeURIComponent(patientId)}`);
      if (res.ok) {
        const data = await res.json();
        setPatientMedications(data.medications || []);
        setAdherenceStats(data.adherenceStats || null);
      } else {
        setPatientMedications([]);
        setAdherenceStats(null);
      }
    } catch (err) {
      console.error("Failed to fetch adherence progression:", err);
      setPatientMedications([]);
      setAdherenceStats(null);
    } finally {
      setLoadingAdherence(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      fetchAdherenceData(selectedPatient.id);
    } else {
      setPatientMedications([]);
      setAdherenceStats(null);
    }
  }, [selectedPatient, fetchAdherenceData]);

  // ─── Drug Interaction Check (Gemini AI) ─────────────────
  const checkInteractions = async (
    drugList: DrugEntry[],
    patient: PatientOption | null = selectedPatient
  ) => {
    if (drugList.length === 0) {
      setDrugInteractions([]);
      setAllergyAlerts([]);
      return;
    }

    setCheckingSafety(true);
    try {
      const res = await fetch("/api/amelia/med-safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient?.id,
          medications: drugList.map((d) => ({ medication: d.medication, dosage: d.dosage })),
          allergies: patient?.allergies || [],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const result = data.result;
        if (result) {
          const mapped: DrugInteraction[] = (result.interactions || []).map(
            (i: { drugs?: string[]; severity?: string; note?: string }) => ({
              drug1: i.drugs?.[0] || "Medication A",
              drug2: i.drugs?.[1] || "Medication B",
              severity:
                i.severity === "high"
                  ? "severe"
                  : i.severity === "moderate"
                  ? "moderate"
                  : "mild",
              description: i.note || "Potential interaction detected.",
            })
          );
          setDrugInteractions(mapped);
          setAllergyAlerts(result.allergyConflicts || []);
        }
      }
    } catch (err) {
      console.error("Safety check error:", err);
    } finally {
      setCheckingSafety(false);
    }
  };

  // ─── Add / Remove Drugs in Prescribing Form ─────────────
  const addDrug = () => {
    if (!newDrug.medication || !newDrug.dosage) return;

    const entry = { ...newDrug, id: Date.now().toString() };
    const updatedDrugs = [...drugs, entry];
    setDrugs(updatedDrugs);
    checkInteractions(updatedDrugs);

    setNewDrug({
      id: "",
      medication: "",
      dosage: "",
      frequency: "Once daily",
      duration: "7 days",
      instructions: "",
      refillsAllowed: 0,
    });
    setShowDrugForm(false);
    setDrugSuggestions([]);
  };

  const removeDrug = (id: string) => {
    const updatedDrugs = drugs.filter((d) => d.id !== id);
    setDrugs(updatedDrugs);
    checkInteractions(updatedDrugs);
  };

  const handleDrugNameChange = (value: string) => {
    setNewDrug({ ...newDrug, medication: value });
    if (value.length >= 2) {
      setDrugSuggestions(
        COMMON_DRUGS.filter((d) => d.toLowerCase().includes(value.toLowerCase()))
      );
    } else {
      setDrugSuggestions([]);
    }
  };

  // ─── Submit Prescription ────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedPatient || drugs.length === 0) return;
    setIsSubmitting(true);

    try {
      for (const drug of drugs) {
        await fetch("/api/medications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: selectedPatient.id,
            medication: drug.medication,
            dosage: drug.dosage,
            frequency: drug.frequency,
            duration: drug.duration,
            instructions: drug.instructions || undefined,
            refillsAllowed: drug.refillsAllowed,
            expiresAt: addDays(new Date(), expiryDays).toISOString(),
          }),
        });
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setDrugs([]);
        setDrugInteractions([]);
        // Switch to Adherence tab and refresh data
        setActiveTab("adherence");
        fetchAdherenceData(selectedPatient.id);
      }, 1500);
    } catch (err) {
      console.error("Prescription submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/doctor/dashboard" className="text-gray-400 hover:text-gray-600">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Medication & Adherence Hub
                </h1>
                <p className="text-gray-500 text-sm">
                  Track 6-month patient adherence progression and prescribe medications
                </p>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("adherence")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                  activeTab === "adherence"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                )}
              >
                <Activity className="w-3.5 h-3.5 text-[var(--primary)]" />
                Adherence Progression (6M)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("prescribe")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                  activeTab === "prescribe"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                )}
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                Prescribe Medication
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Patient Selection Bar */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Selected Patient
            </h2>
            {selectedPatient && (
              <button
                onClick={() => {
                  setSelectedPatient(null);
                  setPatientMedications([]);
                  setAdherenceStats(null);
                }}
                className="text-xs font-bold text-[var(--primary)] hover:underline"
              >
                Switch Patient
              </button>
            )}
          </div>

          {loadingPatients ? (
            <div className="py-6 flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)]" />
              Loading patient roster...
            </div>
          ) : selectedPatient ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/80 rounded-2xl border border-gray-100 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[var(--primary)]/10 text-[var(--primary)] rounded-2xl flex items-center justify-center font-bold text-lg">
                  {selectedPatient.firstName[0]}
                  {selectedPatient.lastName[0]}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </h3>
                  <p className="text-xs text-gray-500">
                    DOB: {format(new Date(selectedPatient.dateOfBirth), "MMM d, yyyy")}
                    {selectedPatient.allergies.length > 0 ? (
                      <span className="text-red-600 ml-2 font-medium">
                        &bull; Allergies: {selectedPatient.allergies.join(", ")}
                      </span>
                    ) : (
                      <span className="text-gray-400 ml-2">&bull; No known drug allergies</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full flex items-center gap-1 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5" /> Care Access Authorized
                </span>
              </div>
            </div>
          ) : (
            <div>
              <div className="relative mb-3">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search patient roster by name..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition-all"
                />
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {filteredPatients.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    {patientSearch ? "No matching patients found" : "No patients found in roster"}
                  </p>
                ) : (
                  filteredPatients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPatient(p);
                        setPatientSearch("");
                        if (drugs.length > 0) {
                          checkInteractions(drugs, p);
                        }
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {p.firstName} {p.lastName}
                          </p>
                          <p className="text-xs text-gray-400">
                            DOB: {format(new Date(p.dateOfBirth), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      {p.allergies.length > 0 && (
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-medium">
                          {p.allergies.length} allergy(ies)
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ────────────────────────────────────────────────── */}
        {/* TAB 1: 6-MONTH ADHERENCE PROGRESSION TRACKING      */}
        {/* ────────────────────────────────────────────────── */}
        {activeTab === "adherence" && (
          <div className="space-y-6">
            {!selectedPatient ? (
              <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
                <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-800 mb-1">
                  Select a Patient to View 6-Month Adherence
                </h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Choose a patient above to review their adherence score, daily dose logs, and personal prescriptions shared with you.
                </p>
              </div>
            ) : loadingAdherence ? (
              <div className="bg-white rounded-3xl border border-gray-100 p-12 flex flex-col items-center justify-center gap-3 shadow-sm">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
                <p className="text-sm text-gray-500 font-medium">
                  Loading 6-month adherence records for {selectedPatient.firstName}...
                </p>
              </div>
            ) : (
              <>
                {/* 6-Month Adherence Summary Hero Card */}
                <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    {/* Score & Progression */}
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
                              (adherenceStats?.overallAdherenceRate ?? 0) >= 80
                                ? "text-emerald-500"
                                : (adherenceStats?.overallAdherenceRate ?? 0) >= 50
                                ? "text-amber-500"
                                : "text-blue-500"
                            )}
                            strokeDasharray={`${adherenceStats?.overallAdherenceRate ?? 0}, 100`}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-xl font-bold text-gray-900 leading-none">
                            {adherenceStats?.overallAdherenceRate ?? 0}%
                          </span>
                          <span className="text-[9px] text-gray-400 font-medium mt-0.5">
                            6-Mo Rate
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> 6-Month Progression Window
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mt-1">
                          Patient Adherence Summary
                        </h3>
                        <p className="text-xs text-gray-500">
                          {adherenceStats?.totalLoggedDoses ?? 0} total doses logged across{" "}
                          {adherenceStats?.activeMedicationsCount ?? 0} active medication(s).
                        </p>
                      </div>
                    </div>

                    {/* Privacy Indicator Badge */}
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 max-w-sm">
                      <div className="flex items-start gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-gray-800">
                            Privacy Isolation Active
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                            Displaying doctor-prescribed medications plus personal patient drugs marked as &quot;Shared with Doctor&quot;. Any unshared patient supplements are strictly isolated and omitted.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Patient Medications List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                      Tracked Medications ({patientMedications.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("prescribe")}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Prescribe Another Drug
                    </button>
                  </div>

                  {patientMedications.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center shadow-sm">
                      <Pill className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm font-bold text-gray-800">
                        No medications found for this patient
                      </p>
                      <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto mb-4">
                        This patient currently has no active prescriptions or shared medications in the 6-month window.
                      </p>
                      <button
                        onClick={() => setActiveTab("prescribe")}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-xs font-bold rounded-xl shadow-sm hover:opacity-90 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Write First Prescription
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {patientMedications.map((med) => {
                        const isDoctorAdded = (med.addedBy ?? "DOCTOR") === "DOCTOR";
                        const logs = med.usageLogs || [];
                        const isExpanded = expandedLogId === med.id;

                        // Sort logs descending
                        const sortedLogs = [...logs].sort().reverse();
                        const recentLogs = sortedLogs.slice(0, 10);

                        return (
                          <div
                            key={med.id}
                            className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all space-y-4"
                          >
                            {/* Card Top Row */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[var(--primary)]/10 text-[var(--primary)] rounded-xl flex items-center justify-center">
                                  <Pill className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-base font-bold text-gray-900">
                                      {med.medication}
                                    </h4>
                                    <span className="px-2 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold rounded-full">
                                      {med.dosage}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {med.frequency} &middot; {med.duration}
                                    {med.instructions ? ` &middot; "${med.instructions}"` : ""}
                                  </p>
                                </div>
                              </div>

                              {/* Source badge */}
                              <div className="flex items-center gap-2">
                                {isDoctorAdded ? (
                                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg flex items-center gap-1">
                                    <User className="w-3 h-3" /> Prescribed by Dr.{" "}
                                    {med.doctor?.user?.firstName || "You"}
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg flex items-center gap-1 border border-emerald-200">
                                    <ShieldCheck className="w-3 h-3" /> Patient Self-Reported (Shared)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Adherence Progression Bar */}
                            <div>
                              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                                <span className="text-gray-500">
                                  Adherence Progression ({med.daysTracked} days tracked)
                                </span>
                                <span
                                  className={cn(
                                    "font-bold",
                                    med.adherenceRate >= 80
                                      ? "text-emerald-600"
                                      : med.adherenceRate >= 50
                                      ? "text-amber-600"
                                      : "text-blue-600"
                                  )}
                                >
                                  {med.adherenceRate}% &middot; {med.totalLoggedDoses} doses logged
                                </span>
                              </div>
                              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    med.adherenceRate >= 80
                                      ? "bg-emerald-500"
                                      : med.adherenceRate >= 50
                                      ? "bg-amber-500"
                                      : "bg-blue-500"
                                  )}
                                  style={{ width: `${Math.min(100, Math.max(5, med.adherenceRate))}%` }}
                                />
                              </div>
                            </div>

                            {/* Recent Daily Logs Timeline */}
                            <div className="pt-2 border-t border-gray-50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                                  <CalendarDays className="w-3.5 h-3.5" /> Recent Taken Date Stamps
                                </span>
                                {logs.length > 10 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedLogId(isExpanded ? null : med.id)
                                    }
                                    className="text-xs font-bold text-[var(--primary)] hover:underline"
                                  >
                                    {isExpanded ? "Show Less" : `View all (${logs.length})`}
                                  </button>
                                )}
                              </div>

                              {logs.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">
                                  No dose logs recorded by patient yet.
                                </p>
                              ) : (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {(isExpanded ? sortedLogs : recentLogs).map((l, idx) => {
                                    const dateStr = l.includes("T") ? l.split("T")[0] : l;
                                    const parsed = parseISO(dateStr);
                                    return (
                                      <span
                                        key={idx}
                                        className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[11px] font-medium rounded-md flex items-center gap-1"
                                      >
                                        <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                                        {format(parsed, "MMM d")}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────── */}
        {/* TAB 2: PRESCRIBE / UPLOAD MEDICATION               */}
        {/* ────────────────────────────────────────────────── */}
        {activeTab === "prescribe" && (
          <div className="space-y-6">
            {/* Success notification */}
            {submitSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 animate-in fade-in">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <p className="text-emerald-800 font-bold text-sm">
                  Prescription submitted successfully! The patient has been notified and the medication is active on their daily schedule.
                </p>
              </div>
            )}

            {/* Prescribe card */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Add & Prescribe Medications
                  </h2>
                  <p className="text-xs text-gray-500">
                    Real-time Gemini AI drug safety, allergy conflict checking, and automatic patient schedule synchronization
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDrugForm(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] hover:opacity-90 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Medication
                </button>
              </div>

              {/* AI Safety Analysis Loader */}
              {checkingSafety && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-2 text-xs text-blue-700">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  Gemini AI analyzing potential drug interactions and allergy conflicts...
                </div>
              )}

              {/* Allergy Conflicts */}
              {allergyAlerts.length > 0 && (
                <div className="space-y-2">
                  {allergyAlerts.map((alert, idx) => (
                    <div
                      key={`allergy-${idx}`}
                      className="p-3.5 rounded-2xl border flex items-start gap-3 bg-red-50 border-red-200"
                    >
                      <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-600" />
                      <div>
                        <p className="text-xs font-bold text-red-800">
                          Allergy Warning: {alert.medication} conflicts with patient allergy ({alert.allergy})
                        </p>
                        <p className="text-xs text-red-700 mt-0.5">{alert.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Drug Interactions */}
              {drugInteractions.length > 0 && (
                <div className="space-y-2">
                  {drugInteractions.map((interaction, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3.5 rounded-2xl border flex items-start gap-3",
                        interaction.severity === "severe"
                          ? "bg-red-50 border-red-200"
                          : interaction.severity === "moderate"
                          ? "bg-amber-50 border-amber-200"
                          : "bg-yellow-50 border-yellow-200"
                      )}
                    >
                      <ShieldAlert
                        className={cn(
                          "w-5 h-5 mt-0.5 flex-shrink-0",
                          interaction.severity === "severe"
                            ? "text-red-600"
                            : interaction.severity === "moderate"
                            ? "text-amber-600"
                            : "text-yellow-600"
                        )}
                      />
                      <div>
                        <p
                          className={cn(
                            "text-xs font-bold",
                            interaction.severity === "severe"
                              ? "text-red-800"
                              : interaction.severity === "moderate"
                              ? "text-amber-800"
                              : "text-yellow-800"
                          )}
                        >
                          {interaction.severity.toUpperCase()} INTERACTION: {interaction.drug1} + {interaction.drug2}
                        </p>
                        <p
                          className={cn(
                            "text-xs mt-0.5",
                            interaction.severity === "severe"
                              ? "text-red-700"
                              : interaction.severity === "moderate"
                              ? "text-amber-700"
                              : "text-yellow-700"
                          )}
                        >
                          {interaction.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Drug list */}
              {drugs.length === 0 && !showDrugForm && (
                <div className="py-10 text-center text-gray-500 border border-dashed border-gray-200 rounded-2xl">
                  <Pill className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-gray-700">
                    No medications drafted yet
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Click &quot;Add Medication&quot; above to draft a prescription for{" "}
                    {selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : "this patient"}
                  </p>
                </div>
              )}

              {drugs.length > 0 && (
                <div className="space-y-3">
                  {drugs.map((drug) => (
                    <div
                      key={drug.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100"
                    >
                      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Pill className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm">
                          {drug.medication} &mdash; {drug.dosage}
                        </p>
                        <p className="text-xs text-gray-500">
                          {drug.frequency} &middot; {drug.duration}
                          {drug.refillsAllowed > 0 && ` &middot; ${drug.refillsAllowed} refills`}
                        </p>
                        {drug.instructions && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            &quot;{drug.instructions}&quot;
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeDrug(drug.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Drug Form */}
              {showDrugForm && (
                <div className="border border-[var(--primary)]/30 bg-[var(--primary)]/5 rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-gray-900 text-sm">New Medication Entry</h3>

                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      Drug Name *
                    </label>
                    <input
                      type="text"
                      value={newDrug.medication}
                      onChange={(e) => handleDrugNameChange(e.target.value)}
                      placeholder="e.g. Amoxicillin"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm bg-white"
                    />
                    {drugSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                        {drugSuggestions.map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              setNewDrug({ ...newDrug, medication: s });
                              setDrugSuggestions([]);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">
                        Dosage *
                      </label>
                      <input
                        type="text"
                        value={newDrug.dosage}
                        onChange={(e) => setNewDrug({ ...newDrug, dosage: e.target.value })}
                        placeholder="e.g. 500mg"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">
                        Frequency
                      </label>
                      <select
                        value={newDrug.frequency}
                        onChange={(e) => setNewDrug({ ...newDrug, frequency: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm bg-white"
                      >
                        {FREQUENCY_OPTIONS.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">
                        Duration
                      </label>
                      <select
                        value={newDrug.duration}
                        onChange={(e) => setNewDrug({ ...newDrug, duration: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm bg-white"
                      >
                        {DURATION_OPTIONS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">
                        Refills Allowed
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={12}
                        value={newDrug.refillsAllowed}
                        onChange={(e) =>
                          setNewDrug({
                            ...newDrug,
                            refillsAllowed: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      Instructions (optional)
                    </label>
                    <textarea
                      value={newDrug.instructions}
                      onChange={(e) => setNewDrug({ ...newDrug, instructions: e.target.value })}
                      rows={2}
                      placeholder="e.g. Take with meals in the morning. Avoid grapefruit."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm resize-none bg-white"
                    />
                  </div>

                  {selectedPatient && selectedPatient.allergies.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-700">
                        <strong>Patient allergies:</strong> {selectedPatient.allergies.join(", ")}.
                        Verify this medication is safe.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowDrugForm(false)}
                      className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addDrug}
                      disabled={!newDrug.medication || !newDrug.dosage}
                      className="px-5 py-2 bg-[var(--primary)] hover:opacity-90 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add to Prescription
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Section */}
              {drugs.length > 0 && selectedPatient && (
                <div className="pt-4 border-t border-gray-100 space-y-4">
                  <div className="flex items-center gap-4">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Prescription Expiry
                      </label>
                      <select
                        value={expiryDays}
                        onChange={(e) => setExpiryDays(parseInt(e.target.value))}
                        className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[var(--primary)] outline-none bg-white"
                      >
                        <option value={7}>7 days</option>
                        <option value={14}>14 days</option>
                        <option value={30}>30 days</option>
                        <option value={60}>60 days</option>
                        <option value={90}>90 days</option>
                        <option value={180}>180 days</option>
                        <option value={365}>1 year</option>
                      </select>
                      <span className="text-xs text-gray-400 ml-2">
                        Expires on {format(addDays(new Date(), expiryDays), "MMMM d, yyyy")}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting Prescription...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Submit & Notify Patient ({drugs.length} medication{drugs.length > 1 ? "s" : ""})
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
