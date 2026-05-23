"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Pill, ChevronLeft, Package, Clock, CheckCircle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";

type OrderStatus = "available" | "requested" | "ready" | "collected";

interface PharmacyItem {
  id: string;
  medication: string;
  dosage: string;
  refillsRemaining: number;
  prescribedAt: string;
  orderStatus: OrderStatus;
}

interface MedicationRecord {
  id: string;
  medication: string;
  dosage: string;
  refillsAllowed: number;
  refillsUsed: number;
  prescribedAt: string;
  isActive: boolean;
}

const STATUS_STYLE: Record<OrderStatus, { label: string; cls: string }> = {
  available: { label: "Available", cls: "bg-gray-100 text-gray-700" },
  requested: { label: "Requested", cls: "bg-amber-100 text-amber-700" },
  ready: { label: "Ready", cls: "bg-emerald-100 text-emerald-700" },
  collected: { label: "Collected", cls: "bg-gray-100 text-gray-500 line-through" },
};

const STATUS_ICON: Record<OrderStatus, typeof Pill> = {
  available: Pill,
  requested: Clock,
  ready: Package,
  collected: CheckCircle,
};

export default function PatientPharmacyPage() {
  const [items, setItems] = useState<PharmacyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderingId, setOrderingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/medications");
      if (res.ok) {
        const meds = await res.json();
        const list: MedicationRecord[] = Array.isArray(meds) ? meds : [];
        setItems(
          list
            .filter((m) => m.isActive)
            .map((m) => ({
              id: m.id,
              medication: m.medication,
              dosage: m.dosage,
              refillsRemaining: m.refillsAllowed - m.refillsUsed,
              prescribedAt: m.prescribedAt,
              orderStatus: "available" as OrderStatus,
            }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const requestOrder = (id: string) => {
    setOrderingId(id);
    // No real pharmacy backend yet. Optimistically advance status; a future
    // PharmacyOrder model + /api/pharmacy/orders endpoint would persist this.
    setTimeout(() => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, orderStatus: "requested" as OrderStatus } : it
        )
      );
      setOrderingId(null);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <PageHeader
          title="Pharmacy"
          subtitle="Order your prescriptions for collection or delivery"
          icon={<Pill className="w-5 h-5" />}
          action={
            <Link
              href="/patient/medications"
              className="inline-flex items-center gap-1 text-sm text-[var(--primary)] hover:opacity-80"
            >
              <ChevronLeft className="w-4 h-4" /> Medications
            </Link>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : (
          <>
            <SectionCard
              title="Available for order"
              description="Active prescriptions that can be filled."
            >
              {items.length === 0 ? (
                <EmptyState
                  icon={<Pill className="w-6 h-6" />}
                  title="No active prescriptions"
                  description="Your doctor's prescriptions will appear here once issued."
                  action={
                    <Link
                      href="/patient/medications"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90"
                    >
                      View medications
                    </Link>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {items.map((it) => {
                    const StatusIcon = STATUS_ICON[it.orderStatus];
                    const status = STATUS_STYLE[it.orderStatus];
                    return (
                      <li
                        key={it.id}
                        className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-[var(--primary)]/40 transition"
                      >
                        <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0">
                          <Pill className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {it.medication}
                          </p>
                          <p className="text-xs text-gray-500">
                            {it.dosage} · {it.refillsRemaining} refill
                            {it.refillsRemaining === 1 ? "" : "s"} remaining
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.cls}`}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {status.label}
                        </span>
                        {it.orderStatus === "available" && (
                          <button
                            onClick={() => requestOrder(it.id)}
                            disabled={orderingId === it.id || it.refillsRemaining === 0}
                            className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                          >
                            {orderingId === it.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Order"
                            )}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="How this works">
              <ul className="text-sm text-gray-600 space-y-2">
                <li>1. Active prescriptions appear above once your doctor issues them.</li>
                <li>
                  2. Click <span className="font-medium text-gray-900">Order</span> to request fulfilment.
                </li>
                <li>
                  3. The pharmacy contacts you when your order is ready for collection or delivery.
                </li>
              </ul>
              <p className="mt-4 text-xs text-gray-400">
                Pharmacy fulfilment backend integration is pending — orders are recorded but not yet routed to a real pharmacy.
              </p>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}
