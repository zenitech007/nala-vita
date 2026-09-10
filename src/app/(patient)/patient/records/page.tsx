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
  Lock,
  Unlock,
  Share2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertCircle,
  X,
  UserPlus,
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
  followup: "bg-[var(--primary)]/10 text-[var(--primary)]",
  "follow-up": "bg-[var(--primary)]/10 text-[var(--primary)]",
  consultation: "bg-purple-100 text-purple-700",
  procedure: "bg-amber-100 text-amber-700",
  general: "bg-gray-100 text-gray-700",
};

function categoryStyle(cat: string | null) {
  if (!cat) return "bg-gray-100 text-gray-600";
  return CATEGORY_COLORS[cat.toLowerCase()] ?? "bg-gray-100 text-gray-600";
}

// ─── Medical Notes Tab ───────────────────────────────────

function MedicalNotesTab({
  notes,
  onTogglePrivacy,
}: {
  notes: MedicalNote[];
  onTogglePrivacy: (noteId: string, isPrivate: boolean) => Promise<void>;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePrivacyToggle = async (note: MedicalNote) => {
    setUpdatingId(note.id);
    try {
      await onTogglePrivacy(note.id, !note.isPrivate);
    } finally {
      setUpdatingId(null);
    }
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
      {/* Privacy Information Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <span className="font-semibold">Privacy & Access Controls:</span> You have full authority over which medical notes are shared. Restricted (private) notes remain visible only to you and are withheld from transferred healthcare providers and external doctors.
        </div>
      </div>

      {notes.map((note) => {
        const expanded = expandedIds.has(note.id);
        const needsTruncate = note.content.length > 200;
        const displayContent =
          expanded || !needsTruncate
            ? note.content
            : note.content.slice(0, 200) + "...";
        const isUpdating = updatingId === note.id;

        return (
          <div
            key={note.id}
            className={cn(
              "bg-white rounded-xl border p-5 shadow-sm transition-all",
              note.isPrivate ? "border-amber-200 bg-amber-50/20" : "border-gray-200"
            )}
          >
            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
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
                {/* Privacy Badge */}
                {note.isPrivate ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    <Lock className="w-3 h-3 text-amber-600" />
                    Restricted (Private)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Shared with Care Team
                  </span>
                )}
              </div>

              {/* Privacy Toggle Button */}
              <button
                disabled={isUpdating}
                onClick={() => handlePrivacyToggle(note)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                  note.isPrivate
                    ? "bg-white border-amber-300 text-amber-800 hover:bg-amber-50"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-red-700 hover:border-red-300"
                )}
                title={
                  note.isPrivate
                    ? "Allow authorized doctors to view this note"
                    : "Restrict access - hide this note from external doctors"
                }
              >
                {isUpdating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : note.isPrivate ? (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-amber-600" />
                    Make Shared
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-gray-500" />
                    Restrict Access
                  </>
                )}
              </button>
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
                className="mt-2 text-sm font-medium text-[var(--primary)] hover:text-[var(--primary)]"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}

            {note.isPrivate && (
              <p className="text-xs text-amber-700 mt-3 pt-3 border-t border-amber-100 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                This note is restricted. External or transferred healthcare providers cannot view this note.
              </p>
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
                        className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-[var(--primary)] hover:text-[var(--primary)]"
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
                ? "bg-[var(--primary)] text-white"
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
    color: "text-[var(--primary)]",
    bgColor: "bg-[var(--primary)]/10",
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
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          View Full History
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

// ─── Referrals Tab (Doctor-to-Doctor Transfers with Patient Approval) ──

function ReferralsTab({
  referrals,
  onApproveTransfer,
  onDeclineTransfer,
}: {
  referrals: Referral[];
  onApproveTransfer: (id: string) => Promise<void>;
  onDeclineTransfer: (id: string) => Promise<void>;
}) {
  const [actioningId, setActioningId] = useState<string | null>(null);

  function statusStyle(status: string) {
    switch (status.toUpperCase()) {
      case "PENDING":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "ACCEPTED":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "DECLINED":
        return "bg-rose-100 text-rose-700 border-rose-200";
      case "COMPLETED":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-600 border-gray-200";
    }
  }

  const handleAction = async (id: string, action: "ACCEPTED" | "DECLINED") => {
    setActioningId(id);
    try {
      if (action === "ACCEPTED") {
        await onApproveTransfer(id);
      } else {
        await onDeclineTransfer(id);
      }
    } finally {
      setActioningId(null);
    }
  };

  if (referrals.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <UserCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-lg font-medium">No referrals or transfers</p>
        <p className="text-sm mt-1">Doctor transfers and care referrals will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Transfer Information Banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-sm text-indigo-800">
          <span className="font-semibold">Doctor-to-Doctor Transfers & Patient Approval:</span> When a doctor initiates a referral or transfer to another specialist/hospital, your clinical records are strictly protected. The receiving doctor cannot access your medical file until you approve the transfer below.
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {referrals.map((ref) => {
          const isPending = ref.status.toUpperCase() === "PENDING";
          const isAccepted = ref.status.toUpperCase() === "ACCEPTED";
          const isDeclined = ref.status.toUpperCase() === "DECLINED";
          const isProcessing = actioningId === ref.id;

          return (
            <div key={ref.id} className="px-6 py-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Transfer of Care
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-xs text-gray-500">
                      Initiated by {doctorName(ref.referringDoctor)} ({ref.referringDoctor.specialization})
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-gray-900 mt-1">
                    Referred to: {doctorName(ref.referredDoctor)}
                  </h3>
                  <p className="text-xs text-indigo-600 font-medium">
                    Specialty: {ref.referredDoctor.specialization}
                  </p>

                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm text-gray-700">
                    <span className="font-medium text-gray-900 block mb-0.5">Reason for Transfer:</span>
                    {ref.reason}
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                  <span
                    className={cn(
                      "text-xs font-medium px-3 py-1 rounded-full border whitespace-nowrap",
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

              {/* Action area for pending patient approval */}
              {isPending && (
                <div className="mt-4 pt-4 border-t border-amber-100 bg-amber-50/50 -mx-6 -mb-5 px-6 py-4 rounded-b-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      <p className="text-xs text-amber-900">
                        <span className="font-semibold">Action Required:</span> Do you authorize {doctorName(ref.referredDoctor)} to access your medical records and care history?
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        disabled={isProcessing}
                        onClick={() => handleAction(ref.id, "DECLINED")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-medium rounded-lg transition disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4 text-red-500" />
                        Decline
                      </button>
                      <button
                        disabled={isProcessing}
                        onClick={() => handleAction(ref.id, "ACCEPTED")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Approve Transfer & Share Records
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isAccepted && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Transfer approved by you. {doctorName(ref.referredDoctor)} has authorized access to your shared records.
                  </span>
                </div>
              )}

              {isDeclined && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-rose-700">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    Transfer declined. Record access was withheld from {doctorName(ref.referredDoctor)}.
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Modal: Patient Self-Initiated Data Share to Doctor/Hospital ─

interface AvailableDoctor {
  id: string;
  specialization: string;
  rating: number;
  user: {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

function ShareRecordsModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [doctors, setDoctors] = useState<AvailableDoctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    async function loadDoctors() {
      setLoadingDoctors(true);
      setError(null);
      try {
        const res = await fetch("/api/doctors?limit=30");
        if (res.ok) {
          const json = await res.json();
          setDoctors(json.doctors || []);
        }
      } catch {
        setError("Failed to load doctor directory");
      } finally {
        setLoadingDoctors(false);
      }
    }
    loadDoctors();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      setError("Please select a healthcare provider");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/patients/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: selectedDoctorId,
          reason: reason.trim() || "Patient Direct Medical Record Share",
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to share medical records");
      }

      onSuccess(data.message || "Medical records shared successfully");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error sharing records");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[var(--primary)]/10 text-[var(--primary)] rounded-xl">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Share Records with Doctor</h2>
              <p className="text-xs text-gray-500">Authorize a healthcare provider to review your medical history</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Select Healthcare Provider <span className="text-red-500">*</span>
            </label>
            {loadingDoctors ? (
              <div className="flex items-center gap-2 p-3 text-sm text-gray-500 bg-gray-50 rounded-xl">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)]" />
                Loading doctors...
              </div>
            ) : (
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition"
              >
                <option value="">-- Choose a doctor or specialist --</option>
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    Dr. {doc.user.firstName} {doc.user.lastName} — {doc.specialization}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Reason for Sharing
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Second opinion, new primary physician, specialist consult"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Message or Clinical Context (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide any specific symptoms or questions for the doctor to review..."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition"
            />
          </div>

          {/* Sharing Security Notice */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-semibold text-emerald-900">Protected Health Data Sharing</span>
            </div>
            <ul className="text-xs text-emerald-800 space-y-1 list-disc list-inside">
              <li>Shares your active prescriptions, vitals, and lab results</li>
              <li>Shares clinical visit notes, <strong>excluding notes you marked as Restricted (Private)</strong></li>
              <li>Directly links the provider to your record in accordance with patient authorization</li>
            </ul>
          </div>

          {/* Footer actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--primary)] hover:opacity-95 text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authorizing...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  Authorize & Share Records
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────

export default function PatientRecordsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("notes");
  const [data, setData] = useState<RecordsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

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

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleTogglePrivacy = async (noteId: string, isPrivate: boolean) => {
    try {
      const res = await fetch("/api/patients/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, isPrivate }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to update record privacy");
      }

      // Update state locally
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          medicalNotes: prev.medicalNotes.map((n) =>
            n.id === noteId ? { ...n, isPrivate } : n
          ),
        };
      });

      setFeedback({
        type: "success",
        text: resData.message || (isPrivate ? "Record restricted (private)." : "Record shared with care team."),
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update privacy setting",
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleApproveTransfer = async (referralId: string) => {
    try {
      const res = await fetch("/api/referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralId, action: "ACCEPTED" }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to approve transfer");
      }

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          referrals: prev.referrals.map((r) =>
            r.id === referralId ? { ...r, status: "ACCEPTED" } : r
          ),
        };
      });

      setFeedback({
        type: "success",
        text: "Transfer approved. The receiving doctor now has access to your medical records.",
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to approve transfer",
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleDeclineTransfer = async (referralId: string) => {
    try {
      const res = await fetch("/api/referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralId, action: "DECLINED" }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to decline transfer");
      }

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          referrals: prev.referrals.map((r) =>
            r.id === referralId ? { ...r, status: "DECLINED" } : r
          ),
        };
      });

      setFeedback({
        type: "success",
        text: "Transfer declined. Record access was withheld.",
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to decline transfer",
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header with Share Records Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medical Records</h1>
          <p className="text-sm text-gray-500 mt-1">
            View your complete medical history, manage privacy, and authorize doctor transfers.
          </p>
        </div>
        <button
          onClick={() => setShowShareModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] text-white text-sm font-semibold rounded-xl hover:opacity-95 shadow-sm transition-all self-start sm:self-auto"
        >
          <Share2 className="w-4 h-4" />
          Share Records with Doctor
        </button>
      </div>

      {/* Floating feedback alert */}
      {feedback && (
        <div
          className={cn(
            "mb-6 p-4 rounded-xl text-sm flex items-center justify-between border animate-fadeIn",
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          )}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
                    ? "border-[var(--primary)] text-[var(--primary)]"
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
          <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-red-500 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-[var(--primary)] hover:text-[var(--primary)] font-medium"
          >
            Try again
          </button>
        </div>
      ) : data ? (
        <>
          {activeTab === "notes" && (
            <MedicalNotesTab
              notes={data.medicalNotes}
              onTogglePrivacy={handleTogglePrivacy}
            />
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
            <ReferralsTab
              referrals={data.referrals}
              onApproveTransfer={handleApproveTransfer}
              onDeclineTransfer={handleDeclineTransfer}
            />
          )}
        </>
      ) : null}

      {/* Share Modal */}
      <ShareRecordsModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onSuccess={(msg) => {
          setFeedback({ type: "success", text: msg });
          fetchRecords();
        }}
      />
    </div>
  );
}
