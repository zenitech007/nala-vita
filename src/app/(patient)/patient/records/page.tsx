"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  FlaskConical,
  Pill,
  HeartPulse,
  UserCheck,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Activity,
  Heart,
  Thermometer,
  Droplets,
  Weight,
  Candy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────

interface DoctorUser {
  firstName: string;
  lastName: string;
}

interface DoctorRef {
  user: DoctorUser;
}

interface MedicalNote {
  id: string;
  title: string;
  content: string;
  category: string | null;
  createdAt: string;
  isPrivate: boolean;
  doctor: { user: DoctorUser };
}

interface LabResult {
  id: string;
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
  doctor: { user: DoctorUser };
  results: LabResult[];
}

interface Prescription {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  isActive: boolean;
  prescribedAt: string;
  expiresAt: string | null;
  doctor: { user: DoctorUser };
}

interface VitalEntry {
  value: unknown;
  recordedAt: string;
}

interface Referral {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  referringDoctor: { user: DoctorUser; specialization: string };
  referredDoctor: { user: DoctorUser; specialization: string };
}

interface RecordsData {
  medicalNotes: MedicalNote[];
  labOrders: LabOrder[];
  prescriptions: Prescription[];
  vitals: Record<string, VitalEntry>;
  referrals: Referral[];
}

// ─── Tabs ────────────────────────────────────────────────

type Tab = "notes" | "labs" | "prescriptions" | "vitals" | "referrals";

const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: "notes", label: "Medical Notes", icon: FileText },
  { key: "labs", label: "Lab History", icon: FlaskConical },
  { key: "prescriptions", label: "Prescriptions", icon: Pill },
  { key: "vitals", label: "Vitals Summary", icon: HeartPulse },
  { key: "referrals", label: "Referrals", icon: UserCheck },
];

// ─── Helpers ─────────────────────────────────────────────

function doctorName(doc: DoctorRef) {
  return `Dr. ${doc.user.firstName} ${doc.user.lastName}`;
}

function formatDate(iso: string) {
  return format(new Date(iso), "MMM d, yyyy");
}

function formatDateTime(iso: string) {
  return format(new Date(iso), "MMM d, yyyy 'at' h:mm a");
}

const CATEGORY_COLORS: Record<string, string> = {
  diagnosis: "bg-red-100 text-red-700",
  followup: "bg-blue-100 text-blue-700",
  "follow-up": "bg-blue-100 text-blue-700",
  consultation: "bg-purple-100 text-purple-700",
  procedure: "bg-amber-100 text-amber-700",
  general: "bg-gray-100 text-gray-700",
};

function categoryStyle(cat: string | null) {
  if (!cat) return "bg-gray-100 text-gray-600";
  return CATEGORY_COLORS[cat.toLowerCase()] ?? "bg-gray-100 text-gray-600";
}

// ─── Medical Notes Tab ───────────────────────────────────

function MedicalNotesTab({ notes }: { notes: MedicalNote[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (notes.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-lg font-medium">No medical notes yet</p>
        <p className="text-sm mt-1">Your doctor&apos;s notes will appear here after visits.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notes.map((note) => {
        const expanded = expandedIds.has(note.id);
        const needsTruncate = note.content.length > 200;
        const displayContent =
          expanded || !needsTruncate
            ? note.content
            : note.content.slice(0, 200) + "...";

        return (
          <div
            key={note.id}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-base font-semibold text-gray-900">
                {note.title}
              </h3>
              {note.category && (
                <span
                  className={cn(
                    "text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap",
                    categoryStyle(note.category)
                  )}
                >
                  {note.category}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
              <span>{formatDate(note.createdAt)}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span>{doctorName(note.doctor)}</span>
            </div>

            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {displayContent}
            </p>

            {needsTruncate && (
              <button
                onClick={() => toggle(note.id)}
                className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Lab History Tab ─────────────────────────────────────

function LabHistoryTab({ orders }: { orders: LabOrder[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  function labStatus(order: LabOrder) {
    if (order.results.length === 0) return "Pending";
    const hasAbnormal = order.results.some((r) => r.isAbnormal);
    return hasAbnormal ? "Abnormal" : "Completed";
  }

  function statusStyle(status: string) {
    switch (status) {
      case "Pending":
        return "bg-yellow-100 text-yellow-700";
      case "Abnormal":
        return "bg-red-100 text-red-700";
      case "Completed":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <FlaskConical className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-lg font-medium">No lab orders</p>
        <p className="text-sm mt-1">Lab test results will be displayed here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
      {orders.map((order) => {
        const expanded = expandedIds.has(order.id);
        const status = labStatus(order);

        return (
          <div key={order.id}>
            <button
              onClick={() => toggle(order.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {order.testName}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  <span>{formatDate(order.orderedAt)}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span>{doctorName(order.doctor)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <span
                  className={cn(
                    "text-xs font-medium px-2.5 py-0.5 rounded-full",
                    statusStyle(status)
                  )}
                >
                  {status}
                </span>
                {expanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </button>

            {expanded && order.results.length > 0 && (
              <div className="px-5 pb-4 space-y-3">
                {order.results.map((result) => (
                  <div
                    key={result.id}
                    className={cn(
                      "rounded-lg p-4 text-sm",
                      result.isAbnormal
                        ? "bg-red-50 border border-red-200"
                        : "bg-gray-50 border border-gray-200"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        Result: {result.resultValue}
                        {result.unit ? ` ${result.unit}` : ""}
                      </span>
                      {result.isAbnormal && (
                        <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                          Abnormal
                        </span>
                      )}
                    </div>
                    {(result.referenceMin || result.referenceMax) && (
                      <p className="text-gray-500 text-xs">
                        Reference range: {result.referenceMin ?? "—"} –{" "}
                        {result.referenceMax ?? "—"}
                        {result.unit ? ` ${result.unit}` : ""}
                      </p>
                    )}
                    <p className="text-gray-400 text-xs mt-1">
                      Completed: {formatDateTime(result.completedAt)}
                    </p>
                    {result.reportUrl && (
                      <a
                        href={result.reportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Full Report
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {expanded && order.results.length === 0 && (
              <div className="px-5 pb-4">
                <p className="text-sm text-gray-500 italic">
                  Results are pending. Check back later.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Prescriptions Tab ───────────────────────────────────

type PrescriptionFilter = "all" | "active" | "expired";

function PrescriptionsTab({ prescriptions }: { prescriptions: Prescription[] }) {
  const [filter, setFilter] = useState<PrescriptionFilter>("all");

  const filtered = prescriptions.filter((p) => {
    if (filter === "active") return p.isActive;
    if (filter === "expired") return !p.isActive;
    return true;
  });

  const FILTERS: { key: PrescriptionFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "expired", label: "Expired" },
  ];

  if (prescriptions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <Pill className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-lg font-medium">No prescriptions</p>
        <p className="text-sm mt-1">Prescription history will appear here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              filter === f.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-10 text-gray-400 text-sm">
          No {filter} prescriptions found.
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map((rx) => (
            <div
              key={rx.id}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-base font-semibold text-gray-900">
                  {rx.medication}
                </h3>
                <span
                  className={cn(
                    "text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap",
                    rx.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  )}
                >
                  {rx.isActive ? "Active" : "Expired"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-sm text-gray-600 mb-3">
                <div>
                  <span className="text-gray-400 text-xs block">Dosage</span>
                  {rx.dosage}
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">Frequency</span>
                  {rx.frequency}
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">Duration</span>
                  {rx.duration}
                </div>
              </div>

              {rx.instructions && (
                <p className="text-xs text-gray-500 italic mb-3">
                  {rx.instructions}
                </p>
              )}

              <div className="flex items-center gap-3 text-xs text-gray-400 pt-2 border-t border-gray-100">
                <span>Prescribed: {formatDate(rx.prescribedAt)}</span>
                {rx.expiresAt && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span>Expires: {formatDate(rx.expiresAt)}</span>
                  </>
                )}
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span>{doctorName(rx.doctor)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Vitals Summary Tab ──────────────────────────────────

interface VitalCardConfig {
  key: string;
  label: string;
  icon: typeof Heart;
  color: string;
  bgColor: string;
  format: (value: unknown) => string;
}

const VITAL_CARDS: VitalCardConfig[] = [
  {
    key: "bloodPressure",
    label: "Blood Pressure",
    icon: Droplets,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    format: (v) => (typeof v === "string" ? v : `${v}`),
  },
  {
    key: "heartRate",
    label: "Heart Rate",
    icon: Heart,
    color: "text-red-500",
    bgColor: "bg-red-50",
    format: (v) => `${v} bpm`,
  },
  {
    key: "temperature",
    label: "Temperature",
    icon: Thermometer,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    format: (v) => `${v} °F`,
  },
  {
    key: "oxygenSaturation",
    label: "SpO2",
    icon: Activity,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    format: (v) => `${v}%`,
  },
  {
    key: "weight",
    label: "Weight",
    icon: Weight,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    format: (v) => `${v} kg`,
  },
  {
    key: "bloodSugar",
    label: "Blood Sugar",
    icon: Candy,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    format: (v) => `${v} mg/dL`,
  },
];

function VitalsSummaryTab({ vitals }: { vitals: Record<string, VitalEntry> }) {
  const hasAny = VITAL_CARDS.some((vc) => vitals[vc.key]);

  if (!hasAny) {
    return (
      <div className="text-center py-16 text-gray-500">
        <HeartPulse className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-lg font-medium">No vitals recorded</p>
        <p className="text-sm mt-1">
          Vital readings will appear here once recorded.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {VITAL_CARDS.map((vc) => {
          const entry = vitals[vc.key];
          const Icon = vc.icon;

          return (
            <div
              key={vc.key}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("p-2.5 rounded-lg", vc.bgColor)}>
                  <Icon className={cn("w-5 h-5", vc.color)} />
                </div>
                <span className="text-sm font-medium text-gray-600">
                  {vc.label}
                </span>
              </div>

              {entry ? (
                <>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {vc.format(entry.value)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Recorded {formatDateTime(entry.recordedAt)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400">No data available</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/patient/vitals"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          View Full History
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

// ─── Referrals Tab ───────────────────────────────────────

function ReferralsTab({ referrals }: { referrals: Referral[] }) {
  function statusStyle(status: string) {
    switch (status.toUpperCase()) {
      case "PENDING":
        return "bg-amber-100 text-amber-700";
      case "ACCEPTED":
        return "bg-blue-100 text-blue-700";
      case "COMPLETED":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  if (referrals.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <UserCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-lg font-medium">No referrals</p>
        <p className="text-sm mt-1">Doctor referrals will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
      {referrals.map((ref) => (
        <div key={ref.id} className="px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {doctorName(ref.referredDoctor)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {ref.referredDoctor.specialization}
              </p>
              <p className="text-sm text-gray-600 mt-2">{ref.reason}</p>
            </div>
            <div className="flex flex-col items-end gap-2 ml-4">
              <span
                className={cn(
                  "text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap",
                  statusStyle(ref.status)
                )}
              >
                {ref.status}
              </span>
              <span className="text-xs text-gray-400">
                {formatDate(ref.createdAt)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────

export default function PatientRecordsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("notes");
  const [data, setData] = useState<RecordsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecords() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/records");
        if (!res.ok) throw new Error("Failed to load records");
        const json: RecordsData = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    fetchRecords();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Medical Records</h1>
        <p className="text-sm text-gray-500 mt-1">
          View your complete medical history, lab results, and more.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-red-500 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Try again
          </button>
        </div>
      ) : data ? (
        <>
          {activeTab === "notes" && (
            <MedicalNotesTab notes={data.medicalNotes} />
          )}
          {activeTab === "labs" && (
            <LabHistoryTab orders={data.labOrders} />
          )}
          {activeTab === "prescriptions" && (
            <PrescriptionsTab prescriptions={data.prescriptions} />
          )}
          {activeTab === "vitals" && (
            <VitalsSummaryTab vitals={data.vitals} />
          )}
          {activeTab === "referrals" && (
            <ReferralsTab referrals={data.referrals} />
          )}
        </>
      ) : null}
    </div>
  );
}
