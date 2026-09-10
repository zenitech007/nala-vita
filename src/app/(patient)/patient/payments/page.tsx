"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  CreditCard,
  DollarSign,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  ShieldCheck,
  ArrowUpRight,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  paidAt: string | null;
  createdAt: string;
  appointment: {
    id: string;
    scheduledAt: string;
    consultationType: string;
    doctor: { user: { firstName: string; lastName: string } };
  };
}

type TabKey = "history" | "outstanding" | "insurance";

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

function formatTotals(payments: Payment[]): string {
  const totals = payments.reduce<Record<string, number>>((byCurrency, payment) => {
    const currency = payment.currency.toUpperCase();
    byCurrency[currency] = (byCurrency[currency] || 0) + payment.amount;
    return byCurrency;
  }, {});

  const entries = Object.entries(totals);
  if (entries.length === 0) return "—";
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(" · ");
}

// ─── Component ──────────────────────────────────────────

export default function PatientPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("history");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/payments");
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Unable to load payments");
      }

      if (!Array.isArray(data?.payments)) {
        throw new Error("The payments response was invalid");
      }

      setPayments(data.payments);
    } catch (error) {
      setPayments([]);
      setLoadError(error instanceof Error ? error.message : "Unable to load payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const outstanding = payments.filter((p) => p.status === "PENDING");
  const totalOutstanding = formatTotals(outstanding);
  const totalPaid = formatTotals(
    payments.filter((p) => p.status === "COMPLETED")
  );

  const handlePay = async (payment: Payment) => {
    setPayingId(payment.id);
    setPayError(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: payment.appointment.id }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Unable to start payment");
      }

      if (typeof data?.authorizationUrl !== "string") {
        throw new Error("The payment provider did not return a checkout link");
      }

      window.location.href = data.authorizationUrl;
    } catch (error) {
      setPayError(error instanceof Error ? error.message : "Unable to start payment");
    } finally {
      setPayingId(null);
    }
  };

  const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
    COMPLETED: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100", label: "Paid" },
    PENDING: { icon: Clock, color: "text-amber-600", bg: "bg-amber-100", label: "Pending" },
    FAILED: { icon: XCircle, color: "text-red-600", bg: "bg-red-100", label: "Failed" },
    REFUNDED: { icon: ArrowUpRight, color: "text-[var(--primary)]", bg: "bg-[var(--primary)]/10", label: "Refunded" },
  };

  const CONSULT_LABELS: Record<string, string> = {
    VIDEO: "Video Consultation",
    IN_PERSON: "In-Person Visit",
    PHONE: "Phone Consultation",
    CHAT: "Chat Consultation",
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "history", label: "Payment History" },
    { key: "outstanding", label: `Outstanding (${outstanding.length})` },
    { key: "insurance", label: "Insurance Claims" },
  ];

  const visiblePayments =
    activeTab === "outstanding"
      ? outstanding
      : activeTab === "history"
      ? payments
      : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <Link href="/patient/dashboard" className="text-gray-400 hover:text-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
              <p className="text-gray-500 text-sm">Manage your billing and insurance</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm text-gray-500">Total Paid</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalPaid}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-sm text-gray-500">Outstanding</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalOutstanding}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <p className="text-sm text-gray-500">Insurance Claims</p>
            </div>
            <p className="text-lg font-semibold text-gray-500">Not connected</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-5 py-2.5 rounded-lg text-sm font-medium transition",
                activeTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {payError && (
          <div
            className="mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{payError}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : loadError ? (
          <div className="text-center py-20" role="alert">
            <XCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <p className="text-gray-700 text-lg font-medium">Could not load payments</p>
            <p className="text-gray-500 text-sm mt-1">{loadError}</p>
            <button
              onClick={fetchPayments}
              className="mt-4 text-[var(--primary)] hover:opacity-80 font-medium text-sm"
            >
              Try again
            </button>
          </div>
        ) : activeTab === "insurance" ? (
          <div className="text-center py-20">
            <ShieldCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Insurance claims are not connected yet</p>
            <p className="text-gray-500 text-sm mt-1">
              No claim records are available in Nala Vita.
            </p>
          </div>
        ) : visiblePayments.length === 0 ? (
          <div className="text-center py-20">
            <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {activeTab === "outstanding" ? "No outstanding payments" : "No payment history"}
            </p>
          </div>
        ) : (
          /* Payment list */
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-4">Service</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-4">Date</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-4">Amount</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-4">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-4">Method</th>
                  {activeTab === "outstanding" && (
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-6 py-4">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visiblePayments.map((payment) => {
                  const statusCfg = STATUS_CONFIG[payment.status] || STATUS_CONFIG.PENDING;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <tr key={payment.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {CONSULT_LABELS[payment.appointment.consultationType] || payment.appointment.consultationType}
                          </p>
                          <p className="text-xs text-gray-500">
                            Dr. {payment.appointment.doctor.user.firstName} {payment.appointment.doctor.user.lastName}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-700">
                          {format(new Date(payment.createdAt), "MMM d, yyyy")}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatMoney(payment.amount, payment.currency)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", statusCfg.bg, statusCfg.color)}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-500">{payment.method || "—"}</p>
                      </td>
                      {activeTab === "outstanding" && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handlePay(payment)}
                            disabled={payingId === payment.id}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] hover:opacity-90 text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
                          >
                            {payingId === payment.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CreditCard className="w-4 h-4" />
                            )}
                            Pay Now
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
