"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  FlaskConical,
  Plus,
  Search,
  User,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface LabOrder {
  id: string;
  testName: string;
  testCode: string | null;
  instructions: string | null;
  urgency: string;
  orderedAt: string;
  patient: { user: { firstName: string; lastName: string } };
  results: { id: string; resultValue: string; isAbnormal: boolean; completedAt: string }[];
}

type TabKey = "pending" | "completed";

const COMMON_TESTS = [
  { name: "Complete Blood Count (CBC)", code: "CBC" },
  { name: "Basic Metabolic Panel (BMP)", code: "BMP" },
  { name: "Comprehensive Metabolic Panel (CMP)", code: "CMP" },
  { name: "Lipid Panel", code: "LIPID" },
  { name: "Thyroid Stimulating Hormone (TSH)", code: "TSH" },
  { name: "Hemoglobin A1C", code: "HBA1C" },
  { name: "Urinalysis", code: "UA" },
  { name: "Liver Function Tests (LFT)", code: "LFT" },
  { name: "Prothrombin Time (PT/INR)", code: "PTINR" },
  { name: "Vitamin D, 25-Hydroxy", code: "VITD" },
  { name: "Iron Studies", code: "IRON" },
  { name: "C-Reactive Protein (CRP)", code: "CRP" },
];

export default function DoctorLabOrdersPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOrderForm, setShowOrderForm] = useState(false);

  // Order form state
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [selectedTest, setSelectedTest] = useState("");
  const [testCode, setTestCode] = useState("");
  const [instructions, setInstructions] = useState("");
  const [urgency, setUrgency] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("LOW");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Real patient options
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);

  useEffect(() => {
    async function loadPatients() {
      try {
        const res = await fetch("/api/patients?all=true&limit=50");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.patients)) {
            setPatients(
              data.patients.map((p: { id: string; user?: { firstName?: string; lastName?: string } }) => ({
                id: p.id,
                firstName: p.user?.firstName || "Patient",
                lastName: p.user?.lastName || "",
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load patients for lab orders:", err);
      } finally {
        setLoadingPatients(false);
      }
    }
    loadPatients();
  }, []);

  const filteredPatients = patients.filter((p) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(patientSearch.toLowerCase())
  );

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lab-tests?status=${activeTab}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.labOrders || []);
      }
    } catch {
      // network error
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSubmitOrder = async () => {
    if (!selectedPatient || !selectedTest) return;
    setIsSubmitting(true);

    try {
      await fetch("/api/lab-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          testName: selectedTest,
          testCode: testCode || undefined,
          instructions: instructions || undefined,
          urgency,
        }),
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setShowOrderForm(false);
        resetForm();
        fetchOrders();
      }, 2000);
    } catch {
      //
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedPatient(null);
    setPatientSearch("");
    setSelectedTest("");
    setTestCode("");
    setInstructions("");
    setUrgency("LOW");
  };

  const URGENCY_COLORS: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-700",
    HIGH: "bg-orange-100 text-orange-700",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    LOW: "bg-green-100 text-green-700",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/doctor/dashboard" className="text-gray-400 hover:text-gray-600">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Lab Orders</h1>
                <p className="text-gray-500 text-sm">Order and track laboratory tests</p>
              </div>
            </div>
            <button
              onClick={() => setShowOrderForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] hover:opacity-90 text-white font-semibold rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
              New Lab Order
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
          {([{ key: "pending" as const, label: "Pending" }, { key: "completed" as const, label: "Completed" }]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn("px-5 py-2.5 rounded-lg text-sm font-medium transition", activeTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <FlaskConical className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No {activeTab} lab orders</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const hasResults = order.results.length > 0;
              const hasAbnormal = order.results.some((r) => r.isAbnormal);
              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-6">
                  <div className="flex items-start gap-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", hasResults ? (hasAbnormal ? "bg-red-100" : "bg-green-100") : "bg-amber-100")}>
                      <FlaskConical className={cn("w-6 h-6", hasResults ? (hasAbnormal ? "text-red-600" : "text-green-600") : "text-amber-600")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{order.testName}</h3>
                        {order.testCode && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{order.testCode}</span>}
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", URGENCY_COLORS[order.urgency] || URGENCY_COLORS.LOW)}>
                          {order.urgency}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                        <span className="inline-flex items-center gap-1"><User className="w-3.5 h-3.5" />{order.patient.user.firstName} {order.patient.user.lastName}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Ordered {format(new Date(order.orderedAt), "MMM d, yyyy")}</span>
                      </div>
                      {order.instructions && <p className="text-sm text-gray-400">{order.instructions}</p>}

                      {/* Results */}
                      {hasResults && (
                        <div className={cn("mt-3 p-3 rounded-xl border", hasAbnormal ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200")}>
                          <div className="flex items-center gap-2 mb-1">
                            {hasAbnormal ? <AlertCircle className="w-4 h-4 text-red-600" /> : <CheckCircle className="w-4 h-4 text-green-600" />}
                            <span className={cn("text-sm font-medium", hasAbnormal ? "text-red-700" : "text-green-700")}>
                              {hasAbnormal ? "Abnormal Results" : "Normal Results"}
                            </span>
                          </div>
                          {order.results.map((r) => (
                            <p key={r.id} className="text-sm text-gray-700 mt-1">{r.resultValue}</p>
                          ))}
                        </div>
                      )}

                      {!hasResults && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-amber-600">
                          <Clock className="w-4 h-4" />
                          Awaiting results
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ─── New Lab Order Modal ─── */}
      {showOrderForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowOrderForm(false); resetForm(); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">New Lab Order</h3>
              <button onClick={() => { setShowOrderForm(false); resetForm(); }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {submitSuccess ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-green-700 font-medium">Lab order submitted! Patient notified.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Patient search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                  {selectedPatient ? (
                    <div className="flex items-center justify-between p-3 bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-xl">
                      <span className="text-sm font-medium text-gray-900">{selectedPatient.firstName} {selectedPatient.lastName}</span>
                      <button onClick={() => setSelectedPatient(null)} className="text-xs text-[var(--primary)]">Change</button>
                    </div>
                  ) : (
                    <div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="Search patient..." className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm" />
                      </div>
                      {patientSearch && (
                        <div className="mt-1 border border-gray-200 rounded-xl max-h-32 overflow-y-auto">
                          {filteredPatients.map((p) => (
                            <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(""); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">{p.firstName} {p.lastName}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Test selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Test *</label>
                  <select
                    value={selectedTest}
                    onChange={(e) => {
                      setSelectedTest(e.target.value);
                      const test = COMMON_TESTS.find((t) => t.name === e.target.value);
                      if (test) setTestCode(test.code);
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm bg-white"
                  >
                    <option value="">Select a test...</option>
                    {COMMON_TESTS.map((t) => (
                      <option key={t.code} value={t.name}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                </div>

                {/* Urgency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Urgency</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((u) => (
                      <button
                        key={u}
                        onClick={() => setUrgency(u)}
                        className={cn("px-3 py-2 rounded-xl text-xs font-medium border-2 transition capitalize", urgency === u ? `${URGENCY_COLORS[u]} border-current` : "border-gray-200 text-gray-500")}
                      >
                        {u.toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Instructions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (optional)</label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    rows={2}
                    placeholder="e.g., Fasting for 8 hours required..."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm resize-none"
                  />
                </div>

                <button
                  onClick={handleSubmitOrder}
                  disabled={!selectedPatient || !selectedTest || isSubmitting}
                  className="w-full py-3 bg-[var(--primary)] hover:opacity-90 text-white font-semibold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><FlaskConical className="w-4 h-4" /> Submit Lab Order</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
