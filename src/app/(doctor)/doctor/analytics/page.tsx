"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  Users,
  Clock,
  Star,
  DollarSign,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ───────────────────────────────────────────────

type DateRange = "7d" | "30d" | "90d" | "12m";

// ─── Component ──────────────────────────────────────────

export default function DoctorAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, [dateRange]);

  // ─── Summary cards data ────────────────────────────────

  const summaryCards = [
    {
      label: "Total Patients",
      value: dateRange === "7d" ? "24" : dateRange === "30d" ? "87" : dateRange === "90d" ? "215" : "842",
      icon: Users,
      color: "bg-blue-100",
      iconColor: "text-blue-600",
      change: "+12%",
      changeUp: true,
    },
    {
      label: "Avg. Consultation",
      value: "28 min",
      icon: Clock,
      color: "bg-purple-100",
      iconColor: "text-purple-600",
      change: "-3%",
      changeUp: false,
    },
    {
      label: "Satisfaction Score",
      value: "4.8/5",
      icon: Star,
      color: "bg-amber-100",
      iconColor: "text-amber-600",
      change: "+0.2",
      changeUp: true,
    },
    {
      label: "Total Earnings",
      value: dateRange === "7d" ? "$3,450" : dateRange === "30d" ? "$14,250" : dateRange === "90d" ? "$42,800" : "$168,500",
      icon: DollarSign,
      color: "bg-green-100",
      iconColor: "text-green-600",
      change: "+18%",
      changeUp: true,
    },
  ];

  // ─── Appointments per day data ─────────────────────────

  const generateDailyAppointments = () => {
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : dateRange === "90d" ? 14 : 12;
    const isMonthly = dateRange === "12m";
    return Array.from({ length: days }).map((_, i) => {
      const date = isMonthly
        ? new Date(new Date().getFullYear(), new Date().getMonth() - (days - 1 - i), 1)
        : subDays(new Date(), days - 1 - i);
      const base = isMonthly ? 60 : 5;
      const variance = isMonthly ? 30 : 4;
      return {
        date: isMonthly
          ? format(date, "MMM yyyy")
          : format(date, dateRange === "7d" ? "EEE" : "MMM d"),
        appointments: Math.max(1, Math.floor(base + Math.random() * variance - variance / 2)),
      };
    });
  };

  const dailyAppointments = generateDailyAppointments();

  // ─── Consultation type breakdown ───────────────────────

  const consultationTypes = [
    { name: "Video", value: 42, color: "#3B82F6" },
    { name: "In-Person", value: 28, color: "#10B981" },
    { name: "Phone", value: 18, color: "#F59E0B" },
    { name: "Chat", value: 12, color: "#8B5CF6" },
  ];

  // ─── Revenue over time ────────────────────────────────

  const generateRevenueData = () => {
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : dateRange === "90d" ? 12 : 12;
    const isWeekly = dateRange === "90d";
    const isMonthly = dateRange === "12m";
    return Array.from({ length: days }).map((_, i) => {
      const date = isMonthly
        ? new Date(new Date().getFullYear(), new Date().getMonth() - (days - 1 - i), 1)
        : isWeekly
        ? subDays(new Date(), (days - 1 - i) * 7)
        : subDays(new Date(), days - 1 - i);
      const base = isMonthly ? 12000 : isWeekly ? 3200 : 450;
      const variance = isMonthly ? 4000 : isWeekly ? 1500 : 300;
      return {
        date: isMonthly
          ? format(date, "MMM")
          : isWeekly
          ? `Week ${i + 1}`
          : format(date, dateRange === "7d" ? "EEE" : "MMM d"),
        revenue: Math.max(100, Math.floor(base + Math.random() * variance - variance / 3)),
      };
    });
  };

  const revenueData = generateRevenueData();

  // ─── Top conditions ────────────────────────────────────

  const topConditions = [
    { condition: "Hypertension", count: 34, color: "#3B82F6" },
    { condition: "Type 2 Diabetes", count: 28, color: "#10B981" },
    { condition: "Upper Resp. Infection", count: 22, color: "#F59E0B" },
    { condition: "Anxiety Disorder", count: 18, color: "#8B5CF6" },
    { condition: "Lower Back Pain", count: 15, color: "#EF4444" },
  ];

  // ─── Date range options ────────────────────────────────

  const dateRanges: { key: DateRange; label: string }[] = [
    { key: "7d", label: "7 Days" },
    { key: "30d", label: "30 Days" },
    { key: "90d", label: "90 Days" },
    { key: "12m", label: "12 Months" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/doctor/dashboard" className="text-gray-400 hover:text-gray-600">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
                <p className="text-gray-500 text-sm">Practice performance overview</p>
              </div>
            </div>
            {/* Date range selector */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {dateRanges.map((r) => (
                <button
                  key={r.key}
                  onClick={() => { setLoading(true); setDateRange(r.key); }}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition",
                    dateRange === r.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {summaryCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", card.color)}>
                        <Icon className={cn("w-5 h-5", card.iconColor)} />
                      </div>
                      <span
                        className={cn(
                          "text-xs font-medium flex items-center gap-0.5",
                          card.changeUp ? "text-green-600" : "text-red-500"
                        )}
                      >
                        <TrendingUp className={cn("w-3.5 h-3.5", !card.changeUp && "rotate-180")} />
                        {card.change}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{card.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  </div>
                );
              })}
            </div>

            {/* Charts row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Appointments per day */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Appointments</h3>
                    <p className="text-sm text-gray-500">
                      {dateRange === "12m" ? "Monthly" : "Daily"} appointment volume
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">
                      {dailyAppointments.reduce((sum, d) => sum + d.appointments, 0)} total
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dailyAppointments} barSize={dateRange === "7d" ? 32 : 16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#9CA3AF" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#9CA3AF" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Bar dataKey="appointments" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Consultation type pie chart */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Consultation Types</h3>
                  <p className="text-sm text-gray-500">Breakdown by type</p>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={consultationTypes}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {consultationTypes.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                      }}
                      formatter={(value) => [`${value}%`, "Share"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {consultationTypes.map((type) => (
                    <div key={type.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: type.color }}
                      />
                      <span className="text-xs text-gray-600">{type.name}</span>
                      <span className="text-xs font-medium text-gray-900 ml-auto">{type.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Charts row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Revenue over time */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Revenue</h3>
                    <p className="text-sm text-gray-500">Earnings over time</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">
                      ${revenueData.reduce((sum, d) => sum + d.revenue, 0).toLocaleString()} total
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#9CA3AF" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#9CA3AF" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                      formatter={(value) => [`$${Number(value).toLocaleString()}`, "Revenue"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      dot={{ fill: "#10B981", r: 3 }}
                      activeDot={{ r: 5, fill: "#10B981" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Top conditions */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Top Conditions</h3>
                  <p className="text-sm text-gray-500">Most common diagnoses</p>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topConditions} layout="vertical" barSize={14}>
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "#9CA3AF" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="condition"
                      tick={{ fontSize: 10, fill: "#6B7280" }}
                      axisLine={false}
                      tickLine={false}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                      }}
                      formatter={(value) => [value, "Cases"]}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {topConditions.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Condition list */}
                <div className="mt-4 space-y-2">
                  {topConditions.map((c) => (
                    <div key={c.condition} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="text-xs text-gray-600">{c.condition}</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-900">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
