"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Pill,
  Clock,
  RefreshCw,
  ShoppingBag,
  AlertCircle,
  Loader2,
  Calendar,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInHours } from "date-fns";

// ─── Types ───────────────────────────────────────────────

interface Prescription {
  id: string;
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
  doctor: {
    specialization: string;
    user: { firstName: string; lastName: string };
  };
}

export default function PatientPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "expired">("active");

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/prescriptions");
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Unable to load prescriptions");
      }

      if (!Array.isArray(data?.prescriptions)) {
        throw new Error("The prescriptions response was invalid");
      }

      setPrescriptions(data.prescriptions);
    } catch (error) {
      setPrescriptions([]);
      setLoadError(
        error instanceof Error ? error.message : "Unable to load prescriptions"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  const activePrescriptions = prescriptions.filter((p) => p.isActive);
  const expiredPrescriptions = prescriptions.filter((p) => !p.isActive);
  const displayList = activeTab === "active" ? activePrescriptions : expiredPrescriptions;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <Link href="/patient/dashboard" className="text-gray-400 hover:text-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Prescriptions</h1>
              <p className="text-gray-500 text-sm">Track your medications and refills</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-8 w-fit">
          <button
            onClick={() => setActiveTab("active")}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-medium transition",
              activeTab === "active"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Active
            <span className={cn(
              "ml-2 px-2 py-0.5 rounded-full text-xs",
              activeTab === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"
            )}>
              {activePrescriptions.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("expired")}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-medium transition",
              activeTab === "expired"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Expired
            <span className={cn(
              "ml-2 px-2 py-0.5 rounded-full text-xs",
              activeTab === "expired" ? "bg-gray-300 text-gray-700" : "bg-gray-200 text-gray-500"
            )}>
              {expiredPrescriptions.length}
            </span>
          </button>
        </div>

        {/* Prescription List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : loadError ? (
          <div className="text-center py-20" role="alert">
            <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <p className="text-gray-700 text-lg font-medium">Could not load prescriptions</p>
            <p className="text-gray-500 text-sm mt-1">{loadError}</p>
            <button
              onClick={fetchPrescriptions}
              className="mt-4 text-[var(--primary)] hover:opacity-80 font-medium text-sm"
            >
              Try again
            </button>
          </div>
        ) : displayList.length === 0 ? (
          <div className="text-center py-20">
            <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              No {activeTab} prescriptions
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayList.map((rx) => {
              const isExpiringSoon =
                rx.expiresAt &&
                differenceInHours(new Date(rx.expiresAt), new Date()) < 168; // < 7 days
              const refillsRemaining = rx.refillsAllowed - rx.refillsUsed;

              return (
                <div
                  key={rx.id}
                  className={cn(
                    "bg-white rounded-2xl border p-6",
                    rx.isActive ? "border-gray-100" : "border-gray-200 opacity-70"
                  )}
                >
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Drug icon + info */}
                    <div className="flex-1">
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                            rx.isActive ? "bg-emerald-100" : "bg-gray-100"
                          )}
                        >
                          <Pill
                            className={cn(
                              "w-6 h-6",
                              rx.isActive ? "text-emerald-600" : "text-gray-400"
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 text-lg">
                              {rx.medication}
                            </h3>
                            <span className="text-sm text-gray-500">
                              {rx.dosage}
                            </span>
                            {rx.isActive && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                                Active
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mb-2">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {rx.frequency}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {rx.duration}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <User className="w-3.5 h-3.5" />
                              Dr. {rx.doctor.user.firstName} {rx.doctor.user.lastName}
                            </span>
                          </div>

                          {rx.instructions && (
                            <p className="text-sm text-gray-400 mb-3">
                              {rx.instructions}
                            </p>
                          )}

                          {/* Meta info */}
                          <div className="flex flex-wrap gap-3 text-xs">
                            <span className="text-gray-400">
                              Prescribed: {format(new Date(rx.prescribedAt), "MMM d, yyyy")}
                            </span>
                            {rx.expiresAt && (
                              <span
                                className={cn(
                                  isExpiringSoon && rx.isActive
                                    ? "text-amber-600 font-medium"
                                    : "text-gray-400"
                                )}
                              >
                                {rx.isActive ? "Expires" : "Expired"}:{" "}
                                {format(new Date(rx.expiresAt), "MMM d, yyyy")}
                              </span>
                            )}
                            <span className="text-gray-400">
                              Refills: {refillsRemaining}/{rx.refillsAllowed} remaining
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right side: real pharmacy and refill workflows */}
                    {rx.isActive && (
                      <div className="flex flex-col items-end gap-3 flex-shrink-0 sm:min-w-[160px]">
                        <div className="flex gap-2 w-full">
                          <Link
                            href="/patient/pharmacy"
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-xl transition"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            Order
                          </Link>
                          {refillsRemaining > 0 && (
                            <Link
                              href="/patient/medications"
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--primary)] hover:opacity-90 text-white text-xs font-medium rounded-xl transition"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Refill
                            </Link>
                          )}
                        </div>

                        {/* Expiry warning */}
                        {isExpiringSoon && (
                          <div className="flex items-center gap-1 text-xs text-amber-600">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Expiring soon
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
