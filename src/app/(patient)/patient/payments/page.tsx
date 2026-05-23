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

interface InsuranceClaim {
  id: string;
  claimNumber: string;
  status: "SUBMITTED" | "PROCESSING" | "APPROVED" | "DENIED";
  amount: number;
  submittedAt: string;
  service: string;
}

type TabKey = "history" | "outstanding" | "insurance";

// ─── Component ──────────────────────────────────────────

export default function PatientPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("history");
  const [payingId, setPayingId] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments");
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
      }
    } catch {
      // placeholder
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Placeholder payments
  const displayPayments: Payment[] =
    payments.length > 0
      ? payments
      : [
          {
            id: "pay1",
            amount: 150.0,
            currency: "USD",
            status: "COMPLETED",
            method: "Visa **** 4242",
            paidAt: new Date(Date.now() - 86400000 * 2).toISOString(),
            createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
            appointment: {
              id: "apt1",
              scheduledAt: new Date(Date.now() - 86400000 * 2).toISOString(),
              consultationType: "VIDEO",
              doctor: { user: { firstName: "Sarah", lastName: "Johnson" } },
            },
          },
          {
            id: "pay2",
            amount: 200.0,
            currency: "USD",
            status: "COMPLETED",
            method: "Visa **** 4242",
            paidAt: new Date(Date.now() - 86400000 * 10).toISOString(),
            createdAt: new Date(Date.now() - 86400000 * 11).toISOString(),
            appointment: {
              id: "apt2",
              scheduledAt: new Date(Date.now() - 86400000 * 10).toISOString(),
              consultationType: "IN_PERSON",
              doctor: { user: { firstName: "Michael", lastName: "Chen" } },
            },
          },
          {
            id: "pay3",
            amount: 75.0,
            currency: "USD",
            status: "PENDING",
            method: null,
            paidAt: null,
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            appointment: {
              id: "apt3",
              scheduledAt: new Date(Date.now() + 86400000 * 3).toISOString(),
              consultationType: "VIDEO",
              doctor: { user: { firstName: "Sarah", lastName: "Johnson" } },
            },
          },
          {
            id: "pay4",
            amount: 125.0,
            currency: "USD",
            status: "PENDING",
            method: null,
            paidAt: null,
            createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
            appointment: {
              id: "apt4",
              scheduledAt: new Date(Date.now() + 86400000).toISOString(),
              consultationType: "PHONE",
              doctor: { user: { firstName: "Michael", lastName: "Chen" } },
            },
          },
          {
            id: "pay5",
            amount: 300.0,
            currency: "USD",
            status: "REFUNDED",
            method: "Visa **** 4242",
            paidAt: new Date(Date.now() - 86400000 * 20).toISOString(),
            createdAt: new Date(Date.now() - 86400000 * 21).toISOString(),
            appointment: {
              id: "apt5",
              scheduledAt: new Date(Date.now() - 86400000 * 20).toISOString(),
              consultationType: "IN_PERSON",
              doctor: { user: { firstName: "Sarah", lastName: "Johnson" } },
            },
          },
        ];

  // Placeholder insurance claims
  const insuranceClaims: InsuranceClaim[] = [
    { id: "ic1", claimNumber: "CLM-2024-00142", status: "APPROVED", amount: 120.0, submittedAt: new Date(Date.now() - 86400000 * 15).toISOString(), service: "Video Consultation" },
    { id: "ic2", claimNumber: "CLM-2024-00158", status: "PROCESSING", amount: 200.0, submittedAt: new Date(Date.now() - 86400000 * 5).toISOString(), service: "In-Person Visit" },
    { id: "ic3", claimNumber: "CLM-2024-00163", status: "SUBMITTED", amount: 75.0, submittedAt: new Date(Date.now() - 86400000 * 2).toISOString(), service: "Lab Tests" },
    { id: "ic4", claimNumber: "CLM-2024-00101", status: "DENIED", amount: 350.0, submittedAt: new Date(Date.now() - 86400000 * 30).toISOString(), service: "Specialist Referral" },
  ];

  const outstanding = displayPayments.filter((p) => p.status === "PENDING");
  const totalOutstanding = outstanding.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = displayPayments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + p.amount, 0);

  const handlePay = async (payment: Payment) => {
    setPayingId(payment.id);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: payment.appointment.id }),
      });
      if (res.ok) {
        const data = await res.json();
        // Redirect to Paystack hosted checkout
        if (data.authorizationUrl) {
          window.location.href = data.authorizationUrl;
        }
      }
    } catch {
      //
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

  const CLAIM_STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
    SUBMITTED: { color: "text-[var(--primary)]", bg: "bg-[var(--primary)]/10" },
    PROCESSING: { color: "text-amber-700", bg: "bg-amber-100" },
    APPROVED: { color: "text-green-700", bg: "bg-green-100" },
    DENIED: { color: "text-red-700", bg: "bg-red-100" },
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
      ? displayPayments
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
            <p className="text-2xl font-bold text-gray-900">${totalPaid.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-sm text-gray-500">Outstanding</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">${totalOutstanding.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <p className="text-sm text-gray-500">Insurance Claims</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{insuranceClaims.length}</p>
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

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : activeTab === "insurance" ? (
          /* Insurance Claims */
          <div className="space-y-4">
            {insuranceClaims.map((claim) => {
              const cfg = CLAIM_STATUS_CONFIG[claim.status] || CLAIM_STATUS_CONFIG.SUBMITTED;
              return (
                <div key={claim.id} className="bg-white rounded-2xl border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{claim.claimNumber}</p>
                        <p className="text-sm text-gray-500">{claim.service}</p>
                      </div>
                    </div>
                    <span className={cn("px-3 py-1 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
                      {claim.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      Submitted {format(new Date(claim.submittedAt), "MMM d, yyyy")}
                    </span>
                    <span className="font-semibold text-gray-900">${claim.amount.toFixed(2)}</span>
                  </div>
                  {/* Progress tracker */}
                  <div className="mt-4 flex items-center gap-2">
                    {(["SUBMITTED", "PROCESSING", "APPROVED"] as const).map((step, i) => {
                      const steps = ["SUBMITTED", "PROCESSING", "APPROVED", "DENIED"];
                      const currentIdx = steps.indexOf(claim.status);
                      const stepIdx = steps.indexOf(step);
                      const isActive = claim.status !== "DENIED" && stepIdx <= currentIdx;
                      const isDenied = claim.status === "DENIED";
                      return (
                        <div key={step} className="flex items-center gap-2 flex-1">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0",
                            isDenied && step !== "SUBMITTED"
                              ? "bg-gray-100 text-gray-400"
                              : isActive
                              ? "bg-green-500 text-white"
                              : "bg-gray-100 text-gray-400"
                          )}>
                            {isActive && !isDenied ? <CheckCircle className="w-4 h-4" /> : i + 1}
                          </div>
                          <span className={cn("text-xs", isActive && !isDenied ? "text-gray-700 font-medium" : "text-gray-400")}>
                            {step.charAt(0) + step.slice(1).toLowerCase()}
                          </span>
                          {i < 2 && <div className={cn("flex-1 h-0.5", isActive && stepIdx < currentIdx ? "bg-green-500" : "bg-gray-200")} />}
                        </div>
                      );
                    })}
                  </div>
                  {claim.status === "DENIED" && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                      <p className="text-sm text-red-700">Claim denied. Contact your insurance provider for details.</p>
                    </div>
                  )}
                </div>
              );
            })}
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
                          ${payment.amount.toFixed(2)}
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

        {/* Pay All Outstanding */}
        {activeTab === "outstanding" && outstanding.length > 0 && (
          <div className="mt-6 bg-gradient-to-r from-[var(--primary)] to-[var(--primary)] rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-white font-semibold">Pay all outstanding balances</p>
              <p className="text-white/70 text-sm mt-0.5">{outstanding.length} payment{outstanding.length > 1 ? "s" : ""} totaling ${totalOutstanding.toFixed(2)}</p>
            </div>
            <button className="px-6 py-3 bg-white text-[var(--primary)] font-semibold rounded-xl hover:bg-[var(--primary)]/10 transition flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Pay ${totalOutstanding.toFixed(2)}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
