"use client";

import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";

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
  // Patient selection
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);

  // Drug entries
  const [drugs, setDrugs] = useState<DrugEntry[]>([]);
  const [drugInteractions, setDrugInteractions] = useState<DrugInteraction[]>([]);

  // New drug form
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

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Expiry
  const [expiryDays, setExpiryDays] = useState(30);

  // ─── Placeholder patients ──────────────────────────────

  const patients: PatientOption[] = [
    { id: "p1", firstName: "Alice", lastName: "Brown", dateOfBirth: "1985-03-15", allergies: ["Penicillin"] },
    { id: "p2", firstName: "Robert", lastName: "Smith", dateOfBirth: "1978-07-22", allergies: [] },
    { id: "p3", firstName: "Diana", lastName: "Lee", dateOfBirth: "1992-11-08", allergies: ["Sulfa drugs", "Latex"] },
    { id: "p4", firstName: "James", lastName: "Wilson", dateOfBirth: "1965-01-30", allergies: ["Aspirin"] },
    { id: "p5", firstName: "Maria", lastName: "Garcia", dateOfBirth: "1990-06-12", allergies: [] },
  ];

  const filteredPatients = patients.filter((p) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(patientSearch.toLowerCase())
  );

  // ─── Drug interaction check (mock AI) ──────────────────

  const checkInteractions = (drugList: DrugEntry[]) => {
    const interactions: DrugInteraction[] = [];

    // Mock interaction rules
    const interactionMap: Record<string, { with: string; severity: DrugInteraction["severity"]; desc: string }[]> = {
      Lisinopril: [{ with: "Ibuprofen", severity: "moderate", desc: "NSAIDs may reduce the antihypertensive effect of ACE inhibitors and increase risk of renal impairment." }],
      Metformin: [{ with: "Prednisone", severity: "severe", desc: "Corticosteroids may increase blood glucose levels, counteracting Metformin's effect." }],
      Sertraline: [{ with: "Ibuprofen", severity: "moderate", desc: "SSRIs with NSAIDs increase the risk of GI bleeding." }],
      Warfarin: [{ with: "Aspirin", severity: "severe", desc: "Increased risk of major bleeding when combined." }],
    };

    for (let i = 0; i < drugList.length; i++) {
      for (let j = i + 1; j < drugList.length; j++) {
        const name1 = drugList[i].medication;
        const name2 = drugList[j].medication;

        const rules = interactionMap[name1];
        if (rules) {
          const match = rules.find((r) => name2.includes(r.with));
          if (match) {
            interactions.push({
              drug1: name1,
              drug2: name2,
              severity: match.severity,
              description: match.desc,
            });
          }
        }

        // Check reverse
        const rulesReverse = interactionMap[name2];
        if (rulesReverse) {
          const matchReverse = rulesReverse.find((r) => name1.includes(r.with));
          if (matchReverse && !interactions.find((i) => i.drug1 === name2 && i.drug2 === name1)) {
            interactions.push({
              drug1: name2,
              drug2: name1,
              severity: matchReverse.severity,
              description: matchReverse.desc,
            });
          }
        }
      }
    }

    setDrugInteractions(interactions);
  };

  // ─── Add drug ──────────────────────────────────────────

  const addDrug = () => {
    if (!newDrug.medication || !newDrug.dosage) return;

    const entry = { ...newDrug, id: Date.now().toString() };
    const updatedDrugs = [...drugs, entry];
    setDrugs(updatedDrugs);
    checkInteractions(updatedDrugs);

    // Reset form
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

  // ─── Submit prescription ───────────────────────────────

  const handleSubmit = async () => {
    if (!selectedPatient || drugs.length === 0) return;
    setIsSubmitting(true);

    try {
      // Submit each drug as a separate prescription
      for (const drug of drugs) {
        await fetch("/api/prescriptions", {
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
        setSelectedPatient(null);
        setDrugInteractions([]);
      }, 3000);
    } catch {
      // handle error
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <Link href="/doctor/dashboard" className="text-gray-400 hover:text-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Write Prescription</h1>
              <p className="text-gray-500 text-sm">Create and manage prescriptions for your patients</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Success */}
        {submitSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-green-700 font-medium">Prescription submitted successfully! Patient has been notified.</p>
          </div>
        )}

        {/* Step 1: Select Patient */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">1. Select Patient</h2>

          {selectedPatient ? (
            <div className="flex items-center justify-between p-4 bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  <p className="text-xs text-gray-500">
                    DOB: {format(new Date(selectedPatient.dateOfBirth), "MMM d, yyyy")}
                    {selectedPatient.allergies.length > 0 && (
                      <span className="text-red-600 ml-2">
                        Allergies: {selectedPatient.allergies.join(", ")}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="text-sm text-[var(--primary)] hover:text-[var(--primary)] font-medium"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search patient by name..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none"
                />
              </div>
              {patientSearch && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredPatients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPatient(p);
                        setPatientSearch("");
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition text-left"
                    >
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {p.firstName} {p.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          DOB: {format(new Date(p.dateOfBirth), "MMM d, yyyy")}
                        </p>
                      </div>
                      {p.allergies.length > 0 && (
                        <span className="ml-auto text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          {p.allergies.length} allergy(ies)
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Add Drugs */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">2. Medications</h2>
            <button
              onClick={() => setShowDrugForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] hover:opacity-90 text-white text-sm font-medium rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
              Add Drug
            </button>
          </div>

          {/* Drug interaction warnings */}
          {drugInteractions.length > 0 && (
            <div className="mb-4 space-y-2">
              {drugInteractions.map((interaction, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-3 rounded-xl border flex items-start gap-3",
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
                        "text-sm font-semibold",
                        interaction.severity === "severe"
                          ? "text-red-800"
                          : interaction.severity === "moderate"
                          ? "text-amber-800"
                          : "text-yellow-800"
                      )}
                    >
                      {interaction.severity.charAt(0).toUpperCase() + interaction.severity.slice(1)} Interaction: {interaction.drug1} + {interaction.drug2}
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
          {drugs.length > 0 && (
            <div className="space-y-3 mb-4">
              {drugs.map((drug) => (
                <div
                  key={drug.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"
                >
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Pill className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      {drug.medication} — {drug.dosage}
                    </p>
                    <p className="text-xs text-gray-500">
                      {drug.frequency} &middot; {drug.duration}
                      {drug.refillsAllowed > 0 && ` &middot; ${drug.refillsAllowed} refills`}
                    </p>
                    {drug.instructions && (
                      <p className="text-xs text-gray-400 mt-0.5">{drug.instructions}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeDrug(drug.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {drugs.length === 0 && !showDrugForm && (
            <p className="text-gray-400 text-sm text-center py-8">
              No medications added yet. Click &quot;Add Drug&quot; to begin.
            </p>
          )}

          {/* Add drug form */}
          {showDrugForm && (
            <div className="border border-[var(--primary)]/30 bg-[var(--primary)]/10/50 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-gray-900 text-sm">New Medication</h3>

              {/* Drug name with autocomplete */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">Drug Name *</label>
                <input
                  type="text"
                  value={newDrug.medication}
                  onChange={(e) => handleDrugNameChange(e.target.value)}
                  placeholder="Start typing drug name..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm"
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Dosage *</label>
                  <input
                    type="text"
                    value={newDrug.dosage}
                    onChange={(e) => setNewDrug({ ...newDrug, dosage: e.target.value })}
                    placeholder="e.g., 500mg"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Refills Allowed</label>
                  <input
                    type="number"
                    min={0}
                    max={12}
                    value={newDrug.refillsAllowed}
                    onChange={(e) => setNewDrug({ ...newDrug, refillsAllowed: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Instructions (optional)</label>
                <textarea
                  value={newDrug.instructions}
                  onChange={(e) => setNewDrug({ ...newDrug, instructions: e.target.value })}
                  rows={2}
                  placeholder="e.g., Take with food. Avoid alcohol."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm resize-none"
                />
              </div>

              {/* Allergy warning */}
              {selectedPatient && selectedPatient.allergies.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700">
                    <strong>Patient allergies:</strong> {selectedPatient.allergies.join(", ")}.
                    Please verify this medication is safe.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDrugForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={addDrug}
                  disabled={!newDrug.medication || !newDrug.dosage}
                  className="px-5 py-2 bg-[var(--primary)] hover:opacity-90 text-white text-sm font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Medication
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Expiry & Submit */}
        {drugs.length > 0 && selectedPatient && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">3. Prescription Settings</h2>

            <div className="flex items-center gap-4 mb-6">
              <Clock className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prescription Expiry
                </label>
                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(parseInt(e.target.value))}
                  className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm bg-white"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                  <option value={365}>1 year</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Expires on {format(addDays(new Date(), expiryDays), "MMMM d, yyyy")}
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-700">
                <strong>{drugs.length}</strong> medication(s) for{" "}
                <strong>
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </strong>
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Submit Prescription
                </>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
