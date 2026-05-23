"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Plus,
  Activity,
  Heart,
  Thermometer,
  Droplets,
  Weight,
  Wind,
  Loader2,
  CheckCircle,
  X,
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

type VitalType = "bloodPressure" | "heartRate" | "bloodSugar" | "oxygenSaturation" | "weight" | "temperature";

interface VitalConfig {
  key: VitalType;
  label: string;
  unit: string;
  icon: typeof Heart;
  color: string;
  normalMin: number;
  normalMax: number;
  placeholder: string;
}

interface VitalReading {
  id: string;
  date: string;
  value: number;
  valueSystolic?: number;
  valueDiastolic?: number;
  isAbnormal: boolean;
  source: string;
}

// ─── Config ──────────────────────────────────────────────

const VITAL_CONFIGS: VitalConfig[] = [
  { key: "bloodPressure", label: "Blood Pressure", unit: "mmHg", icon: Droplets, color: "#3b82f6", normalMin: 90, normalMax: 140, placeholder: "120/80" },
  { key: "heartRate", label: "Heart Rate", unit: "bpm", icon: Heart, color: "#ef4444", normalMin: 60, normalMax: 100, placeholder: "72" },
  { key: "bloodSugar", label: "Blood Sugar", unit: "mg/dL", icon: Activity, color: "#f59e0b", normalMin: 70, normalMax: 140, placeholder: "100" },
  { key: "oxygenSaturation", label: "SpO2", unit: "%", icon: Wind, color: "#06b6d4", normalMin: 95, normalMax: 100, placeholder: "98" },
  { key: "weight", label: "Weight", unit: "kg", icon: Weight, color: "#8b5cf6", normalMin: 40, normalMax: 150, placeholder: "70" },
  { key: "temperature", label: "Temperature", unit: "°F", icon: Thermometer, color: "#10b981", normalMin: 97, normalMax: 99.5, placeholder: "98.6" },
];

// ─── Generate placeholder chart data ─────────────────────

function generateChartData(config: VitalConfig): VitalReading[] {
  const data: VitalReading[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const mid = (config.normalMin + config.normalMax) / 2;
    const range = config.normalMax - config.normalMin;
    const value = mid + (Math.random() - 0.5) * range * 1.4;
    const rounded = Math.round(value * 10) / 10;
    const isAbnormal = rounded < config.normalMin || rounded > config.normalMax;
    data.push({
      id: `v-${i}`,
      date: format(date, "MMM d"),
      value: rounded,
      isAbnormal,
      source: Math.random() > 0.3 ? "manual" : "wearable",
    });
  }
  return data;
}

// ─── Custom tooltip ──────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: VitalReading }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const reading = payload[0];
  return (
    <div className="bg-white shadow-lg border border-gray-200 rounded-xl px-4 py-3 text-sm">
      <p className="font-medium text-gray-900">{label}</p>
      <p className={cn("font-semibold", reading.payload.isAbnormal ? "text-red-600" : "text-gray-700")}>
        {reading.value} {reading.payload.isAbnormal && "(Abnormal)"}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">Source: {reading.payload.source}</p>
    </div>
  );
}

// ─── Custom dot renderer ─────────────────────────────────

function CustomDot(props: { cx?: number; cy?: number; payload?: VitalReading }) {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={payload.isAbnormal ? 5 : 3}
      fill={payload.isAbnormal ? "#ef4444" : "#3b82f6"}
      stroke={payload.isAbnormal ? "#ef4444" : "#3b82f6"}
      strokeWidth={payload.isAbnormal ? 2 : 0}
    />
  );
}

export default function PatientVitalsPage() {
  const [selectedVital, setSelectedVital] = useState<VitalType>("bloodPressure");
  const [showForm, setShowForm] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [inputSource, setInputSource] = useState<"manual" | "wearable">("manual");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [chartData, setChartData] = useState<Record<VitalType, VitalReading[]>>({} as Record<VitalType, VitalReading[]>);

  useEffect(() => {
    const data: Record<string, VitalReading[]> = {};
    VITAL_CONFIGS.forEach((c) => {
      data[c.key] = generateChartData(c);
    });
    setChartData(data as Record<VitalType, VitalReading[]>);
  }, []);

  const activeConfig = VITAL_CONFIGS.find((c) => c.key === selectedVital)!;
  const activeData = chartData[selectedVital] || [];

  const latestReading = activeData[activeData.length - 1];

  const handleSubmit = async () => {
    if (!inputValue) return;
    setIsSubmitting(true);

    try {
      const body: Record<string, unknown> = { source: inputSource };

      if (selectedVital === "bloodPressure") {
        body.bloodPressure = inputValue;
      } else if (selectedVital === "heartRate") {
        body.heartRate = parseInt(inputValue);
      } else if (selectedVital === "bloodSugar") {
        body.bloodSugar = parseFloat(inputValue);
      } else if (selectedVital === "oxygenSaturation") {
        body.oxygenSaturation = parseFloat(inputValue);
      } else if (selectedVital === "weight") {
        body.weight = parseFloat(inputValue);
      } else if (selectedVital === "temperature") {
        body.temperature = parseFloat(inputValue);
      }

      await fetch("/api/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setSubmitSuccess(true);
      setInputValue("");
      setTimeout(() => {
        setSubmitSuccess(false);
        setShowForm(false);
      }, 2000);
    } catch {
      // handle
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/patient/dashboard" className="text-gray-400 hover:text-gray-600">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Vitals Monitoring</h1>
                <p className="text-gray-500 text-sm">Track and visualize your health metrics</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] hover:opacity-90 text-white font-semibold rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
              Record Vital
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Vital type selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {VITAL_CONFIGS.map((config) => {
            const Icon = config.icon;
            const isActive = selectedVital === config.key;
            const reading = (chartData[config.key] || []).slice(-1)[0];
            return (
              <button
                key={config.key}
                onClick={() => setSelectedVital(config.key)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition",
                  isActive ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-gray-100 bg-white hover:border-gray-300"
                )}
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isActive ? "bg-[var(--primary)]/10" : "bg-gray-100")}>
                  <Icon className={cn("w-5 h-5", isActive ? "text-[var(--primary)]" : "text-gray-400")} />
                </div>
                <span className={cn("text-xs font-medium", isActive ? "text-[var(--primary)]" : "text-gray-600")}>{config.label}</span>
                {reading && (
                  <span className={cn("text-sm font-bold", reading.isAbnormal ? "text-red-600" : "text-gray-900")}>
                    {reading.value} <span className="text-xs font-normal text-gray-400">{config.unit}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {activeConfig.label} — Last 30 Days
              </h2>
              <p className="text-sm text-gray-500">
                Normal range: {activeConfig.normalMin}–{activeConfig.normalMax} {activeConfig.unit}
              </p>
            </div>
            {latestReading && (
              <div className={cn("px-4 py-2 rounded-xl text-sm font-semibold", latestReading.isAbnormal ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>
                Latest: {latestReading.value} {activeConfig.unit}
              </div>
            )}
          </div>

          {/*
            ✅ FIX: pass fixed pixel height directly to ResponsiveContainer.
            Previously we used <div className="h-[320px]"> + height="100%",
            which makes recharts initialise width/height state to -1 and
            measure the parent via ResizeObserver. If the first render
            happens before that measurement settles (common with empty
            initial data + post-mount useEffect populating chartData),
            recharts logs:
              "The width(-1) and height(-1) of chart should be greater than 0"
            Passing height={320} as a pixel number skips the measurement
            race entirely.
          */}
          <div className="w-full">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={activeData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={activeConfig.normalMax} stroke="#fbbf24" strokeDasharray="5 5" label={{ value: "High", position: "right", fill: "#f59e0b", fontSize: 11 }} />
                <ReferenceLine y={activeConfig.normalMin} stroke="#fbbf24" strokeDasharray="5 5" label={{ value: "Low", position: "right", fill: "#f59e0b", fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={activeConfig.color}
                  strokeWidth={2}
                  dot={<CustomDot />}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Readings table */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Readings</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Value</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Source</th>
                </tr>
              </thead>
              <tbody>
                {activeData.slice().reverse().slice(0, 10).map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-700">{r.date}</td>
                    <td className="py-3 px-4 font-medium text-gray-900">{r.value} {activeConfig.unit}</td>
                    <td className="py-3 px-4">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", r.isAbnormal ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>
                        {r.isAbnormal ? "Abnormal" : "Normal"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 capitalize">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ─── Record Vital Modal ─── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Record Vital</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            {submitSuccess ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-green-700 font-medium">Vital recorded successfully!</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Vital type select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vital Type</label>
                  <select
                    value={selectedVital}
                    onChange={(e) => setSelectedVital(e.target.value as VitalType)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none bg-white text-sm"
                  >
                    {VITAL_CONFIGS.map((c) => (
                      <option key={c.key} value={c.key}>{c.label} ({c.unit})</option>
                    ))}
                  </select>
                </div>

                {/* Value input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value ({activeConfig.unit})</label>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={activeConfig.placeholder}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Normal: {activeConfig.normalMin}–{activeConfig.normalMax} {activeConfig.unit}
                  </p>
                </div>

                {/* Source */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["manual", "wearable"] as const).map((src) => (
                      <button
                        key={src}
                        onClick={() => setInputSource(src)}
                        className={cn(
                          "px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition capitalize",
                          inputSource === src ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-gray-200 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        {src}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!inputValue || isSubmitting}
                  className="w-full py-3 bg-[var(--primary)] hover:opacity-90 text-white font-semibold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Reading"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
