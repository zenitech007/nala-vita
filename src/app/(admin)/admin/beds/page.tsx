"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  BedDouble,
  User,
  X,
  Loader2,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

interface Bed {
  id: string;
  ward: string;
  bedNumber: string;
  isOccupied: boolean;
  patientName: string | null;
  admittedAt: string | null;
  notes: string | null;
}

// ─── Seed Data ───────────────────────────────────────────

function createInitialBeds(): Bed[] {
  const wards = [
    { name: "General Ward A", beds: 12 },
    { name: "General Ward B", beds: 12 },
    { name: "ICU", beds: 8 },
    { name: "Pediatrics", beds: 10 },
    { name: "Maternity", beds: 8 },
    { name: "Surgery Recovery", beds: 10 },
  ];

  const occupiedData: Record<string, { patient: string; admitted: string; notes: string }> = {
    "GWA-01": { patient: "Alice Brown", admitted: "2026-04-18", notes: "Post-op monitoring" },
    "GWA-03": { patient: "James Wilson", admitted: "2026-04-19", notes: "Pneumonia treatment" },
    "GWA-07": { patient: "Robert Smith", admitted: "2026-04-20", notes: "Dehydration" },
    "GWB-02": { patient: "Diana Lee", admitted: "2026-04-17", notes: "Cardiac observation" },
    "GWB-05": { patient: "Maria Garcia", admitted: "2026-04-20", notes: "Fracture recovery" },
    "GWB-09": { patient: "Kevin Thompson", admitted: "2026-04-19", notes: "Diabetes management" },
    "ICU-01": { patient: "Anna White", admitted: "2026-04-20", notes: "Critical — ventilator" },
    "ICU-03": { patient: "Tom Harris", admitted: "2026-04-18", notes: "Post-cardiac surgery" },
    "ICU-05": { patient: "Susan Clark", admitted: "2026-04-21", notes: "Severe sepsis" },
    "PED-02": { patient: "Lily Adams (age 6)", admitted: "2026-04-20", notes: "Asthma exacerbation" },
    "PED-06": { patient: "Max Chen (age 3)", admitted: "2026-04-19", notes: "High fever observation" },
    "MAT-01": { patient: "Sarah Johnson", admitted: "2026-04-20", notes: "Pre-labor monitoring" },
    "MAT-04": { patient: "Emma Davis", admitted: "2026-04-19", notes: "Post-delivery recovery" },
    "SRG-02": { patient: "Paul Martinez", admitted: "2026-04-20", notes: "Knee replacement recovery" },
    "SRG-06": { patient: "Helen Lee", admitted: "2026-04-18", notes: "Appendectomy recovery" },
    "SRG-09": { patient: "Frank Moore", admitted: "2026-04-21", notes: "Hernia repair recovery" },
  };

  const prefixes: Record<string, string> = {
    "General Ward A": "GWA",
    "General Ward B": "GWB",
    ICU: "ICU",
    Pediatrics: "PED",
    Maternity: "MAT",
    "Surgery Recovery": "SRG",
  };

  const beds: Bed[] = [];
  wards.forEach((ward) => {
    const prefix = prefixes[ward.name];
    for (let i = 1; i <= ward.beds; i++) {
      const bedNumber = `${prefix}-${String(i).padStart(2, "0")}`;
      const occupied = occupiedData[bedNumber];
      beds.push({
        id: bedNumber,
        ward: ward.name,
        bedNumber,
        isOccupied: !!occupied,
        patientName: occupied?.patient ?? null,
        admittedAt: occupied?.admitted ?? null,
        notes: occupied?.notes ?? null,
      });
    }
  });
  return beds;
}

// ─── Component ──────────────────────────────────────────

export default function AdminBedsPage() {
  const [beds, setBeds] = useState<Bed[]>(createInitialBeds);
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [assignPatient, setAssignPatient] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [wardFilter, setWardFilter] = useState("ALL");

  const wards = Array.from(new Set(beds.map((b) => b.ward)));
  const filteredBeds =
    wardFilter === "ALL" ? beds : beds.filter((b) => b.ward === wardFilter);
  const groupedByWard = wards
    .filter((w) => wardFilter === "ALL" || w === wardFilter)
    .map((ward) => ({
      ward,
      beds: filteredBeds.filter((b) => b.ward === ward),
    }));

  // Summary
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.isOccupied).length;
  const availableBeds = totalBeds - occupiedBeds;
  const occupancyRate = Math.round((occupiedBeds / totalBeds) * 100);

  function handleAssign() {
    if (!selectedBed || !assignPatient.trim()) return;
    setSaving(true);
    setTimeout(() => {
      setBeds((prev) =>
        prev.map((b) =>
          b.id === selectedBed.id
            ? {
                ...b,
                isOccupied: true,
                patientName: assignPatient.trim(),
                admittedAt: new Date().toISOString().slice(0, 10),
                notes: assignNotes.trim() || null,
              }
            : b
        )
      );
      setSelectedBed(null);
      setAssignPatient("");
      setAssignNotes("");
      setSaving(false);
    }, 400);
  }

  function handleDischarge() {
    if (!selectedBed) return;
    setSaving(true);
    setTimeout(() => {
      setBeds((prev) =>
        prev.map((b) =>
          b.id === selectedBed.id
            ? {
                ...b,
                isOccupied: false,
                patientName: null,
                admittedAt: null,
                notes: null,
              }
            : b
        )
      );
      setSelectedBed(null);
      setAssignPatient("");
      setAssignNotes("");
      setSaving(false);
    }, 400);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/dashboard"
                className="text-gray-400 hover:text-gray-600"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Bed Management
                </h1>
                <p className="text-gray-500 text-sm">
                  Ward allocation and patient assignment
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm text-gray-500">Total Beds</p>
            <p className="text-2xl font-bold text-gray-900">{totalBeds}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <p className="text-sm text-gray-500">Occupied</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{occupiedBeds}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <p className="text-sm text-gray-500">Available</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{availableBeds}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm text-gray-500">Occupancy Rate</p>
            <p className="text-2xl font-bold text-gray-900">{occupancyRate}%</p>
            <div className="w-full h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  occupancyRate > 85
                    ? "bg-red-500"
                    : occupancyRate > 60
                    ? "bg-amber-500"
                    : "bg-green-500"
                )}
                style={{ width: `${occupancyRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Ward Filter */}
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg w-fit overflow-x-auto">
          <button
            onClick={() => setWardFilter("ALL")}
            className={cn(
              "px-4 py-2 rounded-md text-xs font-medium transition whitespace-nowrap",
              wardFilter === "ALL"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            )}
          >
            All Wards
          </button>
          {wards.map((w) => (
            <button
              key={w}
              onClick={() => setWardFilter(w)}
              className={cn(
                "px-4 py-2 rounded-md text-xs font-medium transition whitespace-nowrap",
                wardFilter === w
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              )}
            >
              {w}
            </button>
          ))}
        </div>

        {/* Bed Grid — grouped by ward */}
        {groupedByWard.map((group) => {
          const wardOccupied = group.beds.filter((b) => b.isOccupied).length;
          return (
            <div
              key={group.ward}
              className="bg-white rounded-2xl border border-gray-100 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {group.ward}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {wardOccupied} / {group.beds.length} occupied
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
                    Available
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-red-100 border border-red-300" />
                    Occupied
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                {group.beds.map((bed) => (
                  <button
                    key={bed.id}
                    onClick={() => {
                      setSelectedBed(bed);
                      setAssignPatient(bed.patientName ?? "");
                      setAssignNotes(bed.notes ?? "");
                    }}
                    className={cn(
                      "relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition hover:shadow-md group",
                      bed.isOccupied
                        ? "bg-red-50 border-red-200 hover:border-red-300"
                        : "bg-green-50 border-green-200 hover:border-green-300"
                    )}
                  >
                    <BedDouble
                      className={cn(
                        "w-5 h-5 mb-1",
                        bed.isOccupied ? "text-red-500" : "text-green-500"
                      )}
                    />
                    <span className="text-xs font-semibold text-gray-700">
                      {bed.bedNumber.split("-")[1]}
                    </span>
                    {bed.isOccupied && (
                      <span className="text-[10px] text-red-600 truncate max-w-full mt-0.5">
                        {bed.patientName?.split(" ")[0]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </main>

      {/* ── Bed Detail / Assign / Discharge Modal ─────── */}
      {selectedBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    selectedBed.isOccupied
                      ? "bg-red-100"
                      : "bg-green-100"
                  )}
                >
                  <BedDouble
                    className={cn(
                      "w-5 h-5",
                      selectedBed.isOccupied
                        ? "text-red-600"
                        : "text-green-600"
                    )}
                  />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Bed {selectedBed.bedNumber}
                  </h3>
                  <p className="text-xs text-gray-500">{selectedBed.ward}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedBed(null);
                  setAssignPatient("");
                  setAssignNotes("");
                }}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {selectedBed.isOccupied ? (
              /* Occupied bed — show patient info + discharge */
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {selectedBed.patientName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      Admitted: {selectedBed.admittedAt}
                    </span>
                  </div>
                  {selectedBed.notes && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-gray-500 mt-0.5" />
                      <span className="text-sm text-gray-600">
                        {selectedBed.notes}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedBed(null);
                      setAssignPatient("");
                      setAssignNotes("");
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleDischarge}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {saving ? "Discharging..." : "Discharge Patient"}
                  </button>
                </div>
              </div>
            ) : (
              /* Available bed — assign patient */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Name
                  </label>
                  <input
                    type="text"
                    value={assignPatient}
                    onChange={(e) => setAssignPatient(e.target.value)}
                    placeholder="Enter patient name or ID"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder="Reason for admission, special instructions..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedBed(null);
                      setAssignPatient("");
                      setAssignNotes("");
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={saving || !assignPatient.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                    {saving ? "Assigning..." : "Assign Patient"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
