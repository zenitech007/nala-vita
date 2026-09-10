"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  DollarSign,
  TrendingUp,
  Calendar,
  Loader2,
  ArrowUpRight,
  Wallet,
  Clock,
  CheckCircle,
  CreditCard,
  Download,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

// ─── Types ───────────────────────────────────────────────

interface EarningsEntry {
  id: string;
  patientName: string;
  consultationType: string;
  scheduledAt: string;
  amount: number;
  status: string;
  paidAt: string | null;
}

interface PayoutEntry {
  id: string;
  amount: number;
  status: "COMPLETED" | "PENDING" | "PROCESSING";
  method: string;
  processedAt: string;
  period: string;
}

type PeriodKey = "today" | "week" | "month" | "all";

// ─── Component ──────────────────────────────────────────

export default function DoctorBillingPage() {
  const [loading, setLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState<PeriodKey>("month");
  const [allEarnings, setAllEarnings] = useState<EarningsEntry[]>([]);
  const [payouts, setPayouts] = useState<PayoutEntry[]>([]);

  useEffect(() => {
    async function loadBilling() {
      try {
        const res = await fetch("/api/payments");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.payments)) {
            setAllEarnings(
              data.payments.map((p: {
                id: string;
                amount: number;
                status: string;
                paidAt?: string | null;
                createdAt: string;
                patient?: { user?: { firstName?: string; lastName?: string } };
                appointment?: { scheduledAt?: string; consultationType?: string };
              }) => ({
                id: p.id,
                patientName: `${p.patient?.user?.firstName || ""} ${p.patient?.user?.lastName || ""}`.trim() || "Patient",
                consultationType: p.appointment?.consultationType || "VIDEO",
                scheduledAt: p.appointment?.scheduledAt || p.createdAt,
                amount: p.amount,
                status: p.status,
                paidAt: p.paidAt || null,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load doctor payments:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBilling();
  }, []);

  // Filter by period
  const now = new Date();
  const filteredEarnings = allEarnings.filter((e) => {
    const d = new Date(e.scheduledAt);
    if (activePeriod === "today") return d.toDateString() === now.toDateString();
    if (activePeriod === "week") return d >= startOfWeek(now) && d <= endOfWeek(now);
    if (activePeriod === "month") return d >= startOfMonth(now) && d <= endOfMonth(now);
    return true;
  });

  // Revenue calculations
  const todayRevenue = allEarnings
    .filter((e) => new Date(e.scheduledAt).toDateString() === now.toDateString() && e.status === "COMPLETED")
    .reduce((sum, e) => sum + e.amount, 0);

  const weekRevenue = allEarnings
    .filter((e) => {
      const d = new Date(e.scheduledAt);
      return d >= startOfWeek(now) && d <= endOfWeek(now) && e.status === "COMPLETED";
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const monthRevenue = allEarnings
    .filter((e) => {
      const d = new Date(e.scheduledAt);
      return d >= startOfMonth(now) && d <= endOfMonth(now) && e.status === "COMPLETED";
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const pendingAmount = allEarnings
    .filter((e) => e.status === "PENDING")
    .reduce((sum, e) => sum + e.amount, 0);

  const CONSULT_LABELS: Record<string, string> = {
    VIDEO: "Video",
    IN_PERSON: "In-Person",
    PHONE: "Phone",
    CHAT: "Chat",
  };

  const PAYOUT_STATUS: Record<string, { color: string; bg: string }> = {
    COMPLETED: { color: "text-green-700", bg: "bg-green-100" },
    PENDING: { color: "text-amber-700", bg: "bg-amber-100" },
    PROCESSING: { color: "text-[var(--primary)]", bg: "bg-[var(--primary)]/10" },
  };

  const periods: { key: PeriodKey; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "all", label: "All Time" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <Link href="/doctor/dashboard" className="text-gray-400 hover:text-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Billing Dashboard</h1>
              <p className="text-gray-500 text-sm">Revenue and payout overview</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : (
          <>
            {/* Revenue summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="flex items-center gap-0.5 text-xs text-green-600 font-medium">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +12%
                  </span>
                </div>
                <p className="text-sm text-gray-500">Today</p>
                <p className="text-2xl font-bold text-gray-900">${todayRevenue.toFixed(2)}</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-[var(--primary)]" />
                  </div>
                  <span className="flex items-center gap-0.5 text-xs text-green-600 font-medium">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +8%
                  </span>
                </div>
                <p className="text-sm text-gray-500">This Week</p>
                <p className="text-2xl font-bold text-gray-900">${weekRevenue.toFixed(2)}</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className="flex items-center gap-0.5 text-xs text-green-600 font-medium">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +15%
                  </span>
                </div>
                <p className="text-sm text-gray-500">This Month</p>
                <p className="text-2xl font-bold text-gray-900">${monthRevenue.toFixed(2)}</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-gray-900">${pendingAmount.toFixed(2)}</p>
              </div>
            </div>

            {/* Earnings table */}
            <div className="bg-white rounded-2xl border border-gray-100 mb-8">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Earnings per Appointment</h2>
                <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                  {periods.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setActivePeriod(p.key)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition",
                        activePeriod === p.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredEarnings.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No earnings for this period</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-50">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Patient</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Type</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Date</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Amount</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredEarnings.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <User className="w-4 h-4 text-gray-500" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">{entry.patientName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-sm text-gray-600">
                            {CONSULT_LABELS[entry.consultationType] || entry.consultationType}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-sm text-gray-600">
                            {format(new Date(entry.scheduledAt), "MMM d, yyyy")}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-sm font-semibold text-gray-900">${entry.amount.toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
                              entry.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                            )}
                          >
                            {entry.status === "COMPLETED" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {entry.status === "COMPLETED" ? "Paid" : "Pending"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50/50">
                      <td colSpan={3} className="px-6 py-3 text-sm font-medium text-gray-700">
                        Total ({filteredEarnings.length} appointments)
                      </td>
                      <td className="px-6 py-3 text-sm font-bold text-gray-900">
                        ${filteredEarnings.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Payout history */}
            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Payout History</h2>
                <button className="text-sm text-[var(--primary)] hover:text-[var(--primary)] font-medium flex items-center gap-1">
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>
              {payouts.length === 0 ? (
                <div className="text-center py-10">
                  <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No payout history recorded yet</p>
                  <p className="text-gray-400 text-xs mt-1">Completed consultation earnings will be settled on your next payout cycle</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {payouts.map((payout) => {
                    const cfg = PAYOUT_STATUS[payout.status] || PAYOUT_STATUS.PENDING;
                    return (
                      <div key={payout.id} className="px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-gray-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{payout.method}</p>
                            <p className="text-xs text-gray-500">{payout.period}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">${payout.amount.toFixed(2)}</p>
                          <span className={cn("text-xs font-medium", cfg.color)}>
                            {payout.status === "COMPLETED"
                              ? `Paid ${format(new Date(payout.processedAt), "MMM d")}`
                              : payout.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
