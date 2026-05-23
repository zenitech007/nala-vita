"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Activity,
  Heart,
  Thermometer,
  Droplets,
  Wind,
  User,
  X,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ─── Types ───────────────────────────────────────────────

interface PatientVitalSummary {
  id: string;
  name: string;
  age: number;
  gender: string;
  lastUpdated: string;
  bloodPressure: { value: string; status: "normal" | "borderline" | "abnormal" };
  heartRate: { value: string; status: "normal" | "borderline" | "abnormal" };
  bloodSugar: { value: string; status: "normal" | "borderline" | "abnormal" };
  oxygenSaturation: { value: string; status: "normal" | "borderline" | "abnormal" };
  temperature: { value: string; status: "normal" | "borderline" | "abnormal" };
  weight: { value: string; status: "normal" | "borderline" | "abnormal" };
}

interface VitalHistoryPoint {
  date: string;
  value: number;
  isAbnormal: boolean;
}

const STATUS_COLORS = {
  normal: "bg-green-100 text-green-700",
  borderline: "bg-amber-100 text-amber-700",
  abnormal: "bg-red-100 text-red-700",
};

const STATUS_DOT = {
  normal: "bg-green-500",
  borderline: "bg-amber-500",
  abnormal: "bg-red-500",
};

// ─── Placeholder data ────────────────────────────────────

const MONITORED_PATIENTS: PatientVitalSummary[] = [
  {
    id: "p1", name: "Alice Brown", age: 39, gender: "Female", lastUpdated: "2 hours ago",
    bloodPressure: { value: "145/95", status: "abnormal" },
    heartRate: { value: "88", status: "borderline" },
    bloodSugar: { value: "180", status: "abnormal" },
    oxygenSaturation: { value: "97", status: "normal" },
    temperature: { value: "98.8", status: "normal" },
    weight: { value: "68", status: "normal" },
  },
  {
    id: "p2", name: "Robert Smith", age: 46, gender: "Male", lastUpdated: "4 hours ago",
    bloodPressure: { value: "130/85", status: "borderline" },
    heartRate: { value: "112", status: "abnormal" },
    bloodSugar: { value: "95", status: "normal" },
    oxygenSaturation: { value: "98", status: "normal" },
    temperature: { value: "99.2", status: "borderline" },
    weight: { value: "82", status: "normal" },
  },
  {
    id: "p3", name: "Diana Lee", age: 32, gender: "Female", lastUpdated: "6 hours ago",
    bloodPressure: { value: "118/76", status: "normal" },
    heartRate: { value: "70", status: "normal" },
    bloodSugar: { value: "105", status: "normal" },
    oxygenSaturation: { value: "99", status: "normal" },
    temperature: { value: "98.4", status: "normal" },
    weight: { value: "58", status: "normal" },
  },
  {
    id: "p4", name: "James Wilson", age: 59, gender: "Male", lastUpdated: "1 day ago",
    bloodPressure: { value: "155/100", status: "abnormal" },
    heartRate: { value: "95", status: "borderline" },
    bloodSugar: { value: "210", status: "abnormal" },
    oxygenSaturation: { value: "93", status: "abnormal" },
    temperature: { value: "98.6", status: "normal" },
    weight: { value: "95", status: "borderline" },
  },
  {
    id: "p5", name: "Maria Garcia", age: 34, gender: "Female", lastUpdated: "3 hours ago",
    bloodPressure: { value: "122/78", status: "normal" },
    heartRate: { value: "76", status: "normal" },
    bloodSugar: { value: "92", status: "normal" },
    oxygenSaturation: { value: "98", status: "normal" },
    temperature: { value: "100.2", status: "abnormal" },
    weight: { value: "62", status: "normal" },
  },
];

function generateHistory(base: number, range: number): VitalHistoryPoint[] {
  return Array.from({ length: 30 }, (_, i) => {
    const val = Math.round((base + (Math.random() - 0.5) * range) * 10) / 10;
    return {
      date: format(subDays(new Date(), 29 - i), "MMM d"),
      value: val,
      isAbnormal: Math.random() > 0.8,
    };
  });
}

// ─── Detail panel vital config ───────────────────────────

const DETAIL_VITALS = [
  { key: "bloodPressure" as const, label: "Blood Pressure", unit: "mmHg", icon: Droplets, color: "#3b82f6", normalMin: 90, normalMax: 140, baseVal: 125, range: 40 },
  { key: "heartRate" as const, label: "Heart Rate", unit: "bpm", icon: Heart, color: "#ef4444", normalMin: 60, normalMax: 100, baseVal: 78, range: 30 },
  { key: "bloodSugar" as const, label: "Blood Sugar", unit: "mg/dL", icon: Activity, color: "#f59e0b", normalMin: 70, normalMax: 140, baseVal: 110, range: 80 },
  { key: "oxygenSaturation" as const, label: "SpO2", unit: "%", icon: Wind, color: "#06b6d4", normalMin: 95, normalMax: 100, baseVal: 97, range: 6 },
  { key: "temperature" as const, label: "Temperature", unit: "°F", icon: Thermometer, color: "#10b981", normalMin: 97, normalMax: 99.5, baseVal: 98.6, range: 3 },
];

export default function DoctorMonitoringPage() {
  const [selectedPatient, setSelectedPatient] = useState<PatientVitalSummary | null>(null);
  const [detailVitalKey, setDetailVitalKey] = useState<string>("bloodPressure");
  const [filterStatus, setFilterStatus] = useState<"all" | "abnormal">("all");

  const filteredPatients = filterStatus === "all"
    ? MONITORED_PATIENTS
    : MONITORED_PATIENTS.filter((p) => {
        const vitals = [p.bloodPressure, p.heartRate, p.bloodSugar, p.oxygenSaturation, p.temperature, p.weight];
        return vitals.some((v) => v.status === "abnormal");
      });

  const abnormalCount = MONITORED_PATIENTS.filter((p) => {
    const vitals = [p.bloodPressure, p.heartRate, p.bloodSugar, p.oxygenSaturation, p.temperature, p.weight];
    return vitals.some((v) => v.status === "abnormal");
  }).length;

  const activeDetailConfig = DETAIL_VITALS.find((v) => v.key === detailVitalKey)!;
  const historyData = generateHistory(activeDetailConfig.baseVal, activeDetailConfig.range);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/doctor/dashboard" className="text-gray-400 hover:text-gray-600">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Patient Monitoring</h1>
                <p className="text-gray-500 text-sm">
                  {MONITORED_PATIENTS.length} patients &middot;{" "}
                  <span className="text-red-600 font-medium">{abnormalCount} with abnormal vitals</span>
                </p>
              </div>
            </div>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setFilterStatus("all")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition", filterStatus === "all" ? "bg-white shadow-sm text-gray-900" : "text-gray-500")}>
                All Patients
              </button>
              <button onClick={() => setFilterStatus("abnormal")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition", filterStatus === "abnormal" ? "bg-white shadow-sm text-red-600" : "text-gray-500")}>
                Abnormal Only
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-6">
        {/* Table */}
        <div className={cn("flex-1 min-w-0", selectedPatient ? "" : "")}>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-gray-500 uppercase">BP</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-gray-500 uppercase">HR</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-gray-500 uppercase">Sugar</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-gray-500 uppercase">SpO2</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-gray-500 uppercase">Temp</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-gray-500 uppercase">Weight</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((patient) => {
                    const vitals = [
                      patient.bloodPressure,
                      patient.heartRate,
                      patient.bloodSugar,
                      patient.oxygenSaturation,
                      patient.temperature,
                      patient.weight,
                    ];

                    return (
                      <tr
                        key={patient.id}
                        onClick={() => setSelectedPatient(patient)}
                        className={cn(
                          "border-b border-gray-50 cursor-pointer transition",
                          selectedPatient?.id === patient.id ? "bg-[var(--primary)]/10" : "hover:bg-gray-50"
                        )}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-gray-400" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{patient.name}</p>
                              <p className="text-xs text-gray-400">{patient.age}y &middot; {patient.gender}</p>
                            </div>
                          </div>
                        </td>
                        {vitals.map((v, i) => (
                          <td key={i} className="py-3 px-3 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <div className={cn("w-2 h-2 rounded-full", STATUS_DOT[v.status])} />
                              <span className={cn("text-xs font-medium", v.status === "abnormal" ? "text-red-700" : v.status === "borderline" ? "text-amber-700" : "text-gray-700")}>
                                {v.value}
                              </span>
                            </div>
                          </td>
                        ))}
                        <td className="py-3 px-4 text-right">
                          <span className="text-xs text-gray-400">{patient.lastUpdated}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mt-4 px-2">
            {(["normal", "borderline", "abnormal"] as const).map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={cn("w-2.5 h-2.5 rounded-full", STATUS_DOT[s])} />
                <span className="text-xs text-gray-500 capitalize">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Patient Detail Sidebar ─── */}
        {selectedPatient && (
          <div className="w-96 bg-white rounded-2xl border border-gray-100 flex-shrink-0 overflow-y-auto max-h-[calc(100vh-12rem)] sticky top-8">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{selectedPatient.name}</p>
                  <p className="text-xs text-gray-500">{selectedPatient.age}y &middot; {selectedPatient.gender}</p>
                </div>
              </div>
              <button onClick={() => setSelectedPatient(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Current vitals summary */}
            <div className="px-5 py-4 border-b border-gray-100 space-y-2">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Current Vitals</h4>
              {[
                { label: "BP", ...selectedPatient.bloodPressure, unit: "mmHg", key: "bloodPressure" },
                { label: "Heart Rate", ...selectedPatient.heartRate, unit: "bpm", key: "heartRate" },
                { label: "Blood Sugar", ...selectedPatient.bloodSugar, unit: "mg/dL", key: "bloodSugar" },
                { label: "SpO2", ...selectedPatient.oxygenSaturation, unit: "%", key: "oxygenSaturation" },
                { label: "Temp", ...selectedPatient.temperature, unit: "°F", key: "temperature" },
              ].map((v) => (
                <button
                  key={v.key}
                  onClick={() => setDetailVitalKey(v.key)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl transition text-sm",
                    detailVitalKey === v.key ? "bg-[var(--primary)]/10 border border-[var(--primary)]/30" : "hover:bg-gray-50"
                  )}
                >
                  <span className="text-gray-600">{v.label}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", v.status === "abnormal" ? "text-red-700" : v.status === "borderline" ? "text-amber-700" : "text-gray-900")}>
                      {v.value} <span className="text-xs text-gray-400 font-normal">{v.unit}</span>
                    </span>
                    <span className={cn("px-1.5 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[v.status])}>
                      {v.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Vital history chart */}
            <div className="px-5 py-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                {activeDetailConfig.label} — 30 Day Trend
              </h4>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} interval={6} />
                    <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} domain={["dataMin - 5", "dataMax + 5"]} />
                    <Tooltip />
                    <ReferenceLine y={activeDetailConfig.normalMax} stroke="#fbbf24" strokeDasharray="4 4" />
                    <ReferenceLine y={activeDetailConfig.normalMin} stroke="#fbbf24" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="value" stroke={activeDetailConfig.color} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Normal: {activeDetailConfig.normalMin}–{activeDetailConfig.normalMax} {activeDetailConfig.unit}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
