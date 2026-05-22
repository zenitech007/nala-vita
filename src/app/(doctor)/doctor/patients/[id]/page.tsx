"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  Heart,
  Thermometer,
  Droplets,
  Activity,
  Weight,
  Candy,
  Pill,
  FileText,
  FlaskConical,
  ArrowRightLeft,
  Plus,
  X,
  AlertTriangle,
  Phone,
  User,
  Video,
  Clock as _Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ───────────────────────────────────────────────

interface PatientUser {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email: string;
  phone: string | null;
}

interface PatientDetail {
  id: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string | null;
  allergies: string[];
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  insuranceProvider: string | null;
  insuranceNumber: string | null;
  user: PatientUser;
}

interface Vital {
  bloodPressure: string | null;
  heartRate: number | null;
  temperature: number | null;
  oxygenSaturation: number | null;
  weight: number | null;
  bloodSugar: number | null;
  recordedAt: string;
}

interface Prescription {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  isActive: boolean;
  refillsAllowed: number;
  refillsUsed: number;
  doctor: { user: { firstName: string; lastName: string } };
}

interface LabResult {
  resultValue: string;
  unit: string | null;
  referenceMin: string | null;
  referenceMax: string | null;
  isAbnormal: boolean;
  reportUrl: string | null;
  completedAt: string;
}

interface LabOrder {
  id: string;
  testName: string;
  orderedAt: string;
  results: LabResult[];
}

interface MedicalNote {
  id: string;
  title: string;
  content: string;
  category: string | null;
  createdAt: string;
  doctor: { user: { firstName: string; lastName: string } };
}

interface Referral {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  referringDoctor: { user: { firstName: string; lastName: string } };
  referredDoctor: {
    user: { firstName: string; lastName: string };
    specialization: string;
  };
}

interface PatientResponse {
  patient: PatientDetail;
  vitals: Vital[];
  prescriptions: Prescription[];
  labOrders: LabOrder[];
  medicalNotes: MedicalNote[];
  referrals: Referral[];
}

type TabKey =
  | "overview"
  | "vitals"
  | "prescriptions"
  | "lab-results"
  | "notes"
  | "referrals";

// ─── Helpers ─────────────────────────────────────────────

function calculateAge(dateOfBirth: string): number {
  return Math.floor(
    (Date.now() - new Date(dateOfBirth).getTime()) / 31557600000
  );
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "vitals", label: "Vitals" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "lab-results", label: "Lab Results" },
  { key: "notes", label: "Notes" },
  { key: "referrals", label: "Referrals" },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  ACCEPTED: "bg-green-100 text-green-700",
  COMPLETED: "bg-green-100 text-green-700",
  DECLINED: "bg-red-100 text-red-700",
  CANCELLED: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
};

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const NOTE_CATEGORIES = [
  "General",
  "Diagnosis",
  "Treatment",
  "Follow-up",
  "Lab Review",
  "Consultation",
];

// ─── Component ───────────────────────────────────────────

export default function PatientDetailPage() {
  const params = useParams();
  const patientId = params.id as string;

  const [data, setData] = useState<PatientResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteForm, setNoteForm] = useState({
    title: "",
    content: "",
    category: "General",
  });
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const fetchPatient = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/patients/${patientId}`);
      if (res.ok) {
        const json: PatientResponse = await res.json();
        setData(json);
      }
    } catch {
      // network error
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchPatient();
  }, [fetchPatient]);

  const handleAddNote = async () => {
    if (!noteForm.title.trim() || !noteForm.content.trim()) return;
    setNoteSubmitting(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteForm),
      });
      if (res.ok) {
        setNoteModalOpen(false);
        setNoteForm({ title: "", content: "", category: "General" });
        fetchPatient();
      }
    } catch {
      // handle error
    } finally {
      setNoteSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <AlertCircle className="w-12 h-12 text-gray-300 mb-4" />
        <p className="text-gray-500">Patient not found</p>
        <Link
          href="/doctor/patients"
          className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          Back to Patients
        </Link>
      </div>
    );
  }

  const { patient, vitals, prescriptions, labOrders, medicalNotes, referrals } =
    data;
  const fullName = `${patient.user.firstName} ${patient.user.lastName}`;
  const age = calculateAge(patient.dateOfBirth);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ─── Sticky Patient Header ─── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/doctor/patients"
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>

              {/* Avatar */}
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-semibold text-sm">
                  {patient.user.firstName.charAt(0)}
                  {patient.user.lastName.charAt(0)}
                </span>
              </div>

              {/* Patient info */}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-gray-900">
                    {fullName}
                  </h1>
                  <span className="text-sm text-gray-500">
                    {age} yrs &middot; {patient.gender}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {patient.bloodType && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                      <Droplets className="w-3 h-3" />
                      {patient.bloodType}
                    </span>
                  )}
                  {patient.allergies.map((allergy) => (
                    <span
                      key={allergy}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 text-xs font-medium rounded-full"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {allergy}
                    </span>
                  ))}
                  {patient.emergencyName && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                      <Phone className="w-3 h-3" />
                      Emergency: {patient.emergencyName}
                      {patient.emergencyPhone
                        ? ` (${patient.emergencyPhone})`
                        : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Start Consultation */}
            <Link
              href={`/doctor/consultation?patientId=${patientId}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition flex-shrink-0"
            >
              <Video className="w-4 h-4" />
              Start Consultation
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Tabs ─── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition",
                  activeTab === tab.key
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Tab Content ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "overview" && (
          <OverviewTab
            vitals={vitals}
            prescriptions={prescriptions}
            medicalNotes={medicalNotes}
          />
        )}
        {activeTab === "vitals" && <VitalsTab vitals={vitals} />}
        {activeTab === "prescriptions" && (
          <PrescriptionsTab prescriptions={prescriptions} />
        )}
        {activeTab === "lab-results" && <LabResultsTab labOrders={labOrders} />}
        {activeTab === "notes" && (
          <NotesTab
            medicalNotes={medicalNotes}
            onAddNote={() => setNoteModalOpen(true)}
          />
        )}
        {activeTab === "referrals" && <ReferralsTab referrals={referrals} />}
      </div>

      {/* ─── Add Note Modal ─── */}
      {noteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Add Medical Note
              </h3>
              <button
                onClick={() => setNoteModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={noteForm.title}
                  onChange={(e) =>
                    setNoteForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Note title..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={noteForm.category}
                  onChange={(e) =>
                    setNoteForm((f) => ({ ...f, category: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {NOTE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <textarea
                  value={noteForm.content}
                  onChange={(e) =>
                    setNoteForm((f) => ({ ...f, content: e.target.value }))
                  }
                  placeholder="Write your note..."
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setNoteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                disabled={
                  noteSubmitting ||
                  !noteForm.title.trim() ||
                  !noteForm.content.trim()
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition"
              >
                {noteSubmitting && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Overview Tab
// ═══════════════════════════════════════════════════════════

function OverviewTab({
  vitals,
  prescriptions,
  medicalNotes,
}: {
  vitals: Vital[];
  prescriptions: Prescription[];
  medicalNotes: MedicalNote[];
}) {
  const latest = vitals[0] || null;
  const activeMeds = prescriptions.filter((p) => p.isActive);
  const recentNotes = medicalNotes.slice(0, 3);

  const vitalCards = latest
    ? [
        {
          label: "Blood Pressure",
          value: latest.bloodPressure || "--",
          unit: "mmHg",
          icon: Heart,
          color: "text-red-500",
          bg: "bg-red-50",
        },
        {
          label: "Heart Rate",
          value: latest.heartRate != null ? String(latest.heartRate) : "--",
          unit: "bpm",
          icon: Activity,
          color: "text-pink-500",
          bg: "bg-pink-50",
        },
        {
          label: "Temperature",
          value:
            latest.temperature != null
              ? latest.temperature.toFixed(1)
              : "--",
          unit: "°F",
          icon: Thermometer,
          color: "text-orange-500",
          bg: "bg-orange-50",
        },
        {
          label: "SpO2",
          value:
            latest.oxygenSaturation != null
              ? String(latest.oxygenSaturation)
              : "--",
          unit: "%",
          icon: Droplets,
          color: "text-blue-500",
          bg: "bg-blue-50",
        },
        {
          label: "Weight",
          value: latest.weight != null ? String(latest.weight) : "--",
          unit: "kg",
          icon: Weight,
          color: "text-emerald-500",
          bg: "bg-emerald-50",
        },
        {
          label: "Blood Sugar",
          value:
            latest.bloodSugar != null ? String(latest.bloodSugar) : "--",
          unit: "mg/dL",
          icon: Candy,
          color: "text-purple-500",
          bg: "bg-purple-50",
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Latest Vitals */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Latest Vitals
        </h2>
        {vitalCards.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {vitalCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="bg-white rounded-xl border border-gray-100 p-4"
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center mb-2",
                      card.bg
                    )}
                  >
                    <Icon className={cn("w-4 h-4", card.color)} />
                  </div>
                  <p className="text-xs text-gray-500 mb-0.5">{card.label}</p>
                  <p className="text-lg font-bold text-gray-900">
                    {card.value}
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      {card.unit}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No vitals recorded yet</p>
          </div>
        )}
      </section>

      {/* Active Medications */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Active Medications
        </h2>
        {activeMeds.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {activeMeds.map((rx) => (
              <div
                key={rx.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Pill className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {rx.medication}
                    </p>
                    <p className="text-xs text-gray-500">
                      {rx.dosage} &middot; {rx.frequency}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  Dr. {rx.doctor.user.firstName} {rx.doctor.user.lastName}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <Pill className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No active medications</p>
          </div>
        )}
      </section>

      {/* Recent Notes */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Recent Notes
        </h2>
        {recentNotes.length > 0 ? (
          <div className="space-y-3">
            {recentNotes.map((note) => (
              <div
                key={note.id}
                className="bg-white rounded-xl border border-gray-100 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-gray-900">
                      {note.title}
                    </h3>
                    {note.category && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        {note.category}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {format(new Date(note.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {note.content}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Dr. {note.doctor.user.firstName} {note.doctor.user.lastName}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No notes yet</p>
          </div>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Vitals Tab
// ═══════════════════════════════════════════════════════════

function VitalsTab({ vitals }: { vitals: Vital[] }) {
  const recentVitals = vitals.slice(0, 10).reverse();

  if (recentVitals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Activity className="w-12 h-12 text-gray-300 mb-4" />
        <p className="text-gray-500">No vitals data available</p>
      </div>
    );
  }

  const chartConfigs = [
    {
      key: "heartRate",
      label: "Heart Rate",
      unit: "bpm",
      color: "#ec4899",
      getData: (v: Vital) => v.heartRate,
    },
    {
      key: "temperature",
      label: "Temperature",
      unit: "°F",
      color: "#f97316",
      getData: (v: Vital) => v.temperature,
    },
    {
      key: "oxygenSaturation",
      label: "SpO2",
      unit: "%",
      color: "#3b82f6",
      getData: (v: Vital) => v.oxygenSaturation,
    },
    {
      key: "weight",
      label: "Weight",
      unit: "kg",
      color: "#10b981",
      getData: (v: Vital) => v.weight,
    },
    {
      key: "bloodSugar",
      label: "Blood Sugar",
      unit: "mg/dL",
      color: "#8b5cf6",
      getData: (v: Vital) => v.bloodSugar,
    },
  ];

  // Blood pressure chart data (split systolic/diastolic)
  const bpData = recentVitals
    .filter((v) => v.bloodPressure)
    .map((v) => {
      const parts = v.bloodPressure!.split("/");
      return {
        date: format(new Date(v.recordedAt), "MMM d"),
        systolic: parseInt(parts[0]) || null,
        diastolic: parseInt(parts[1]) || null,
      };
    });

  return (
    <div className="space-y-6">
      {/* Blood Pressure Chart */}
      {bpData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Blood Pressure
            <span className="text-xs font-normal text-gray-400 ml-2">
              mmHg
            </span>
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={bpData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "0.75rem",
                  border: "1px solid #e5e7eb",
                  fontSize: "0.75rem",
                }}
              />
              <Line
                type="monotone"
                dataKey="systolic"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Systolic"
              />
              <Line
                type="monotone"
                dataKey="diastolic"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Diastolic"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Other vital charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {chartConfigs.map((config) => {
          const chartData = recentVitals
            .filter((v) => config.getData(v) != null)
            .map((v) => ({
              date: format(new Date(v.recordedAt), "MMM d"),
              value: config.getData(v),
            }));

          if (chartData.length === 0) return null;

          return (
            <div
              key={config.key}
              className="bg-white rounded-xl border border-gray-100 p-5"
            >
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                {config.label}
                <span className="text-xs font-normal text-gray-400 ml-2">
                  {config.unit}
                </span>
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "0.75rem",
                      border: "1px solid #e5e7eb",
                      fontSize: "0.75rem",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={config.color}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={config.label}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Prescriptions Tab
// ═══════════════════════════════════════════════════════════

function PrescriptionsTab({
  prescriptions,
}: {
  prescriptions: Prescription[];
}) {
  if (prescriptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Pill className="w-12 h-12 text-gray-300 mb-4" />
        <p className="text-gray-500">No prescriptions found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {prescriptions.map((rx) => {
        const refillsRemaining = rx.refillsAllowed - rx.refillsUsed;
        return (
          <div
            key={rx.id}
            className="bg-white rounded-xl border border-gray-100 p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center",
                    rx.isActive ? "bg-blue-50" : "bg-gray-50"
                  )}
                >
                  <Pill
                    className={cn(
                      "w-4 h-4",
                      rx.isActive ? "text-blue-500" : "text-gray-400"
                    )}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {rx.medication}
                  </p>
                  <p className="text-xs text-gray-500">
                    {rx.dosage} &middot; {rx.frequency}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "px-2 py-0.5 text-xs font-medium rounded-full",
                    rx.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  )}
                >
                  {rx.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
              <span className="text-xs text-gray-500">
                Prescribed by Dr. {rx.doctor.user.firstName}{" "}
                {rx.doctor.user.lastName}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  refillsRemaining > 0 ? "text-green-600" : "text-red-500"
                )}
              >
                {refillsRemaining > 0
                  ? `${refillsRemaining} refill${refillsRemaining !== 1 ? "s" : ""} remaining`
                  : "No refills remaining"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Lab Results Tab
// ═══════════════════════════════════════════════════════════

function LabResultsTab({ labOrders }: { labOrders: LabOrder[] }) {
  if (labOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FlaskConical className="w-12 h-12 text-gray-300 mb-4" />
        <p className="text-gray-500">No lab results found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {labOrders.map((order) => (
        <div
          key={order.id}
          className="bg-white rounded-xl border border-gray-100 p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {order.testName}
                </p>
                <p className="text-xs text-gray-500">
                  Ordered{" "}
                  {format(new Date(order.orderedAt), "MMM d, yyyy")}
                </p>
              </div>
            </div>
            {order.results.length === 0 && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                Pending
              </span>
            )}
          </div>

          {order.results.length > 0 && (
            <div className="space-y-2 mt-3 pt-3 border-t border-gray-50">
              {order.results.map((result, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg text-sm",
                    result.isAbnormal ? "bg-red-50" : "bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {result.isAbnormal && (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        "font-medium",
                        result.isAbnormal ? "text-red-700" : "text-gray-900"
                      )}
                    >
                      {result.resultValue}
                      {result.unit ? ` ${result.unit}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {(result.referenceMin || result.referenceMax) && (
                      <span>
                        Ref: {result.referenceMin || "--"} -{" "}
                        {result.referenceMax || "--"}
                        {result.unit ? ` ${result.unit}` : ""}
                      </span>
                    )}
                    <span>
                      {format(
                        new Date(result.completedAt),
                        "MMM d, yyyy"
                      )}
                    </span>
                    {result.reportUrl && (
                      <a
                        href={result.reportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Report
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Notes Tab
// ═══════════════════════════════════════════════════════════

function NotesTab({
  medicalNotes,
  onAddNote,
}: {
  medicalNotes: MedicalNote[];
  onAddNote: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Medical Notes
        </h2>
        <button
          onClick={onAddNote}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          Add Note
        </button>
      </div>

      {medicalNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <FileText className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500">No medical notes yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {medicalNotes.map((note) => (
            <div
              key={note.id}
              className="bg-white rounded-xl border border-gray-100 p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {note.title}
                  </h3>
                  {note.category && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                      {note.category}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}
                </span>
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {note.content}
              </p>
              <p className="text-xs text-gray-400 mt-3">
                Dr. {note.doctor.user.firstName} {note.doctor.user.lastName}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Referrals Tab
// ═══════════════════════════════════════════════════════════

function ReferralsTab({ referrals }: { referrals: Referral[] }) {
  if (referrals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ArrowRightLeft className="w-12 h-12 text-gray-300 mb-4" />
        <p className="text-gray-500">No referrals found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {referrals.map((referral) => (
        <div
          key={referral.id}
          className="bg-white rounded-xl border border-gray-100 p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
                <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {referral.reason}
                </p>
                <p className="text-xs text-gray-500">
                  {format(new Date(referral.createdAt), "MMM d, yyyy")}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "px-2.5 py-0.5 text-xs font-medium rounded-full",
                STATUS_COLORS[referral.status] || "bg-gray-100 text-gray-700"
              )}
            >
              {formatStatus(referral.status)}
            </span>
          </div>

          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-50 text-xs">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-500">From:</span>
              <span className="font-medium text-gray-700">
                Dr. {referral.referringDoctor.user.firstName}{" "}
                {referral.referringDoctor.user.lastName}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-500">To:</span>
              <span className="font-medium text-gray-700">
                Dr. {referral.referredDoctor.user.firstName}{" "}
                {referral.referredDoctor.user.lastName}
              </span>
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                {referral.referredDoctor.specialization}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
