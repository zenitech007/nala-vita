"use client";

import { useState, useEffect } from "react";
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
  Loader2,
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

// ─── Status assessment helpers ─────────────────────────

function assessStatus(val: number | null | undefined, min: number, max: number): "normal" | "borderline" | "abnormal" {
  if (val == null) return "normal";
  if (val < min * 0.9 || val > max * 1.1) return "abnormal";
  if (val < min || val > max) return "borderline";
  return "normal";
}

function assessBpStatus(bp: string | null | undefined): "normal" | "borderline" | "abnormal" {
  if (!bp) return "normal";
  const [sys, dia] = bp.split("/").map(Number);
  if (!sys || !dia) return "normal";
  if (sys > 140 || sys < 90 || dia > 90 || dia < 60) return "abnormal";
  if (sys > 125 || dia > 82) return "borderline";
  return "normal";
}

function calculateAge(dob: string | Date | null | undefined): number {
  if (!dob) return 35;
  const birth = new Date(dob);
  const diff = Date.now() - birth.getTime();
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
}

// ─── Detail panel vital config ───────────────────────────

const DETAIL_VITALS = [
  { key: "bloodPressure" as const, label: "Blood Pressure", unit: "mmHg", icon: Droplets, color: "#3b82f6", normalMin: 90, normalMax: 140 },
  { key: "heartRate" as const, label: "Heart Rate", unit: "bpm", icon: Heart, color: "#ef4444", normalMin: 60, normalMax: 100 },
  { key: "bloodSugar" as const, label: "Blood Sugar", unit: "mg/dL", icon: Activity, color: "#f59e0b", normalMin: 70, normalMax: 140 },
  { key: "oxygenSaturation" as const, label: "SpO2", unit: "%", icon: Wind, color: "#06b6d4", normalMin: 95, normalMax: 100 },
  { key: "temperature" as const, label: "Temperature", unit: "°F", icon: Thermometer, color: "#10b981", normalMin: 97, normalMax: 99.5 },
];

export default function DoctorMonitoringPage() {
  const [patients, setPatients] = useState<PatientVitalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<PatientVitalSummary | null>(null);
  const [detailVitalKey, setDetailVitalKey] = useState<string>("bloodPressure");
  const [filterStatus, setFilterStatus] = useState<"all" | "abnormal">("all");
  const [historyData, setHistoryData] = useState<VitalHistoryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    async function loadPatients() {
      try {
        const res = await fetch("/api/vitals");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.patients)) {
            const mapped: PatientVitalSummary[] = data.patients.map((p: {
              id: string;
              dateOfBirth?: string;
              gender?: string;
              user?: { firstName?: string; lastName?: string };
              vitals?: {
                bloodPressure?: string | null;
                heartRate?: number | null;
                bloodSugar?: number | null;
                oxygenSaturation?: number | null;
                temperature?: number | null;
                weight?: number | null;
                recordedAt: string;
              }[];
            }) => {
              const latestVital = p.vitals?.[0] || null;
              const bp = latestVital?.bloodPressure || "--";
              const hr = latestVital?.heartRate != null ? String(latestVital.heartRate) : "--";
              const sugar = latestVital?.bloodSugar != null ? String(latestVital.bloodSugar) : "--";
              const spo2 = latestVital?.oxygenSaturation != null ? String(latestVital.oxygenSaturation) : "--";
              const temp = latestVital?.temperature != null ? String(latestVital.temperature) : "--";
              const wt = latestVital?.weight != null ? String(latestVital.weight) : "--";

              return {
                id: p.id,
                name: `${p.user?.firstName || ""} ${p.user?.lastName || ""}`.trim() || "Patient",
                age: calculateAge(p.dateOfBirth),
                gender: p.gender || "Unknown",
                lastUpdated: latestVital ? format(new Date(latestVital.recordedAt), "MMM d, h:mm a") : "No readings",
                bloodPressure: { value: bp, status: assessBpStatus(latestVital?.bloodPressure) },
                heartRate: { value: hr, status: assessStatus(latestVital?.heartRate, 60, 100) },
                bloodSugar: { value: sugar, status: assessStatus(latestVital?.bloodSugar, 70, 140) },
                oxygenSaturation: { value: spo2, status: assessStatus(latestVital?.oxygenSaturation, 95, 100) },
                temperature: { value: temp, status: assessStatus(latestVital?.temperature, 97, 99.5) },
                weight: { value: wt, status: assessStatus(latestVital?.weight, 40, 150) },
              };
            });
            setPatients(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to load monitored patients:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPatients();
  }, []);

  useEffect(() => {
    if (!selectedPatient) {
      setHistoryData([]);
      return;
    }
    async function loadHistory() {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/vitals?patientId=${selectedPatient!.id}&limit=30`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.vitals)) {
            const config = DETAIL_VITALS.find((v) => v.key === detailVitalKey);
            const pts: VitalHistoryPoint[] = data.vitals
              .map((v: Record<string, unknown>) => {
                let val: number | null = null;
                if (detailVitalKey === "bloodPressure") {
                  val = typeof v.bloodPressure === "string" ? Number(v.bloodPressure.split("/")[0]) : null;
                } else {
                  val = typeof v[detailVitalKey] === "number" ? (v[detailVitalKey] as number) : null;
                }
                if (val == null || isNaN(val)) return null;
                return {
                  date: format(new Date(v.recordedAt as string), "MMM d"),
                  value: val,
                  isAbnormal: config ? val < config.normalMin || val > config.normalMax : false,
                };
              })
              .filter((p: VitalHistoryPoint | null): p is VitalHistoryPoint => p !== null)
              .reverse();
            setHistoryData(pts);
          }
        }
      } catch (err) {
        console.error("Failed to load patient history:", err);
      } finally {
        setLoadingHistory(false);
      }
    }
    loadHistory();
  }, [selectedPatient, detailVitalKey]);

  const filteredPatients = filterStatus === "all"
    ? patients
    : patients.filter((p) => {
        const vList = [p.bloodPressure, p.heartRate, p.bloodSugar, p.oxygenSaturation, p.temperature, p.weight];
        return vList.some((v) => v.status === "abnormal");
      });

  const abnormalCount = patients.filter((p) => {
    const vList = [p.bloodPressure, p.heartRate, p.bloodSugar, p.oxygenSaturation, p.temperature, p.weight];
    return vList.some((v) => v.status === "abnormal");
  }).length;

  const activeDetailConfig = DETAIL_VITALS.find((v) => v.key === detailVitalKey)!;

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
                  {patients.length} patients &middot;{" "}
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
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-20">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No monitored patients found</p>
                <p className="text-gray-400 text-xs mt-1">
                  {filterStatus === "abnormal"
                    ? "No patients currently have abnormal vital signs"
                    : "No patient vitals have been recorded yet"}
                </p>
              </div>
            ) : (
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
            )}
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
              {loadingHistory ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No {activeDetailConfig.label} history recorded</p>
                </div>
              ) : (
                <div className="w-full">
                  <ResponsiveContainer width="100%" height={200}>
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
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Normal: {activeDetailConfig.normalMin}–{activeDetailConfig.normalMax} {activeDetailConfig.unit}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
