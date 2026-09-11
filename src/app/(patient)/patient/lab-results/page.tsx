"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  FlaskConical,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  ChevronRight,
  X,
  Sparkles,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import LabPhotoUpload from "@/components/amelia/LabPhotoUpload";

// ─── Types ───────────────────────────────────────────────

interface LabResult {
  id: string;
  resultValue: string;
  unit: string | null;
  referenceMin: string | null;
  referenceMax: string | null;
  isAbnormal: boolean;
  notes: string | null;
  reportUrl: string | null;
  completedAt: string;
}

interface LabOrder {
  id: string;
  testName: string;
  testCode: string | null;
  instructions: string | null;
  urgency: string;
  orderedAt: string;
  doctor: { user: { firstName: string; lastName: string } };
  results: LabResult[];
}

type FilterKey = "all" | "pending" | "completed" | "abnormal";

// ─── Component ──────────────────────────────────────────

export default function PatientLabResultsPage() {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/lab-tests");
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Unable to load lab results");
      }

      if (!Array.isArray(data?.labOrders)) {
        throw new Error("The lab results response was invalid");
      }

      setOrders(data.labOrders);
    } catch (error) {
      setOrders([]);
      setLoadError(
        error instanceof Error ? error.message : "Unable to load lab results"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real orders from database
  const displayOrders: LabOrder[] = orders;

  // Filter logic
  const filteredOrders = displayOrders.filter((order) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "pending") return order.results.length === 0;
    if (activeFilter === "completed") return order.results.length > 0;
    if (activeFilter === "abnormal")
      return order.results.some((r) => r.isAbnormal);
    return true;
  });

  // Generate AI summary for a lab result using Gemini 2.5 Flash
  const generateAiSummary = async (order: LabOrder) => {
    setAiLoading(true);
    setAiSummary(null);
    try {
      const res = await fetch("/api/ai/lab-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testName: order.testName,
          results: order.results.map((r) => ({
            resultValue: r.resultValue,
            unit: r.unit,
            referenceMin: r.referenceMin,
            referenceMax: r.referenceMax,
            isAbnormal: r.isAbnormal,
            notes: r.notes,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.summary);
      } else {
        const errData = await res.json().catch(() => null);
        setAiSummary(errData?.error || "Unable to generate AI summary at this time. Please consult your physician directly.");
      }
    } catch {
      setAiSummary("Unable to reach the AI summary service. Please review the detailed values below with your doctor.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleViewResult = (order: LabOrder) => {
    setSelectedOrder(order);
    setAiSummary(null);
    if (order.results.length > 0) {
      generateAiSummary(order);
    }
  };

  const URGENCY_COLORS: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-700",
    HIGH: "bg-orange-100 text-orange-700",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    LOW: "bg-green-100 text-green-700",
  };

  const filterTabs: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: displayOrders.length },
    {
      key: "pending",
      label: "Pending",
      count: displayOrders.filter((o) => o.results.length === 0).length,
    },
    {
      key: "completed",
      label: "Completed",
      count: displayOrders.filter((o) => o.results.length > 0).length,
    },
    {
      key: "abnormal",
      label: "Abnormal",
      count: displayOrders.filter((o) => o.results.some((r) => r.isAbnormal)).length,
    },
  ];

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
              <h1 className="text-2xl font-bold text-gray-900">Lab Results</h1>
              <p className="text-gray-500 text-sm">
                View your laboratory test results
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <LabPhotoUpload />

        {/* Load failure — the list below falls back to sample data, so say so */}
        {loadError && (
          <div
            role="alert"
            className="flex items-start gap-3 mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl"
          >
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">{loadError}</p>
              <p className="text-xs text-red-600 mt-0.5">
                Any results shown below are sample data, not your records.
              </p>
            </div>
            <button
              onClick={fetchOrders}
              className="text-xs font-medium text-red-700 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={cn(
                "px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5",
                activeFilter === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  activeFilter === tab.key
                    ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "bg-gray-200 text-gray-500"
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20">
            <FlaskConical className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No lab orders found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const hasResults = order.results.length > 0;
              const hasAbnormal = order.results.some((r) => r.isAbnormal);
              return (
                <button
                  key={order.id}
                  onClick={() => handleViewResult(order)}
                  className="w-full text-left bg-white rounded-2xl border border-gray-100 p-6 hover:border-[var(--primary)]/40 hover:shadow-sm transition"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                        hasResults
                          ? hasAbnormal
                            ? "bg-red-100"
                            : "bg-green-100"
                          : "bg-amber-100"
                      )}
                    >
                      {hasResults ? (
                        hasAbnormal ? (
                          <AlertCircle className="w-6 h-6 text-red-600" />
                        ) : (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        )
                      ) : (
                        <Clock className="w-6 h-6 text-amber-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {order.testName}
                        </h3>
                        {order.testCode && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                            {order.testCode}
                          </span>
                        )}
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium",
                            URGENCY_COLORS[order.urgency] || URGENCY_COLORS.LOW
                          )}
                        >
                          {order.urgency}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>
                          Dr. {order.doctor.user.firstName}{" "}
                          {order.doctor.user.lastName}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Ordered{" "}
                          {format(new Date(order.orderedAt), "MMM d, yyyy")}
                        </span>
                      </div>
                      {/* Status line */}
                      <div className="mt-2">
                        {hasResults ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-sm font-medium",
                              hasAbnormal ? "text-red-600" : "text-green-600"
                            )}
                          >
                            {hasAbnormal ? (
                              <AlertCircle className="w-4 h-4" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            {hasAbnormal
                              ? "Abnormal results — review recommended"
                              : "Results normal"}
                            <span className="text-gray-400 font-normal ml-1">
                              &middot; Completed{" "}
                              {format(
                                new Date(order.results[0].completedAt),
                                "MMM d, yyyy"
                              )}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 font-medium">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Awaiting results
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* ─── Result Detail Modal ─── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedOrder.testName}
                </h3>
                <p className="text-sm text-gray-500">
                  Ordered by Dr. {selectedOrder.doctor.user.firstName}{" "}
                  {selectedOrder.doctor.user.lastName} &middot;{" "}
                  {format(new Date(selectedOrder.orderedAt), "MMMM d, yyyy")}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Test Code</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedOrder.testCode || "—"}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Urgency</p>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      URGENCY_COLORS[selectedOrder.urgency] ||
                        URGENCY_COLORS.LOW
                    )}
                  >
                    {selectedOrder.urgency}
                  </span>
                </div>
              </div>

              {selectedOrder.instructions && (
                <div className="bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-xl p-4">
                  <p className="text-xs text-[var(--primary)] font-medium mb-1">
                    Instructions
                  </p>
                  <p className="text-sm text-blue-800">
                    {selectedOrder.instructions}
                  </p>
                </div>
              )}

              {/* Results section */}
              {selectedOrder.results.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Test Results
                  </h4>
                  {selectedOrder.results.map((result) => (
                    <div
                      key={result.id}
                      className={cn(
                        "border rounded-xl p-4 mb-3",
                        result.isAbnormal
                          ? "bg-red-50 border-red-200"
                          : "bg-green-50 border-green-200"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {result.isAbnormal ? (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                        <span
                          className={cn(
                            "text-sm font-medium",
                            result.isAbnormal
                              ? "text-red-700"
                              : "text-green-700"
                          )}
                        >
                          {result.isAbnormal ? "Abnormal" : "Normal"}
                        </span>
                        <span className="text-xs text-gray-400 ml-auto">
                          Completed{" "}
                          {format(
                            new Date(result.completedAt),
                            "MMM d, yyyy 'at' h:mm a"
                          )}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {result.resultValue}
                      </p>
                      {(result.referenceMin || result.referenceMax) && (
                        <p className="text-xs text-gray-500 mt-2">
                          Reference range: {result.referenceMin || "—"} –{" "}
                          {result.referenceMax || "—"} {result.unit || ""}
                        </p>
                      )}
                      {result.notes && (
                        <p className="text-xs text-gray-600 mt-2 italic">
                          {result.notes}
                        </p>
                      )}
                      {result.reportUrl && (
                        <a
                          href={result.reportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-3 text-xs text-[var(--primary)] hover:text-[var(--primary)] font-medium"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download full report
                        </a>
                      )}
                    </div>
                  ))}

                  {/* AI Summary */}
                  <div className="mt-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <h4 className="text-sm font-semibold text-purple-900">
                        AI Plain-Language Summary
                      </h4>
                    </div>
                    {aiLoading ? (
                      <div className="flex items-center gap-2 py-3">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                        <span className="text-sm text-purple-600">
                          Generating your personalized summary...
                        </span>
                      </div>
                    ) : aiSummary ? (
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {aiSummary}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Unable to generate summary
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-3">
                      This summary is AI-generated for informational purposes
                      only. Always consult your doctor for medical advice.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">
                    Results are pending
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Your doctor has ordered this test. Results will appear here
                    once they are available.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
