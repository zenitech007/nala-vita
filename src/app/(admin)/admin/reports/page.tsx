"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Stethoscope,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Activity,
  Loader2,
  Download,
  BarChart3,
  PieChartIcon,
  CreditCard,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
} from "date-fns";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

// ─── Types ───────────────────────────────────────────────

interface Overview {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  totalRevenue: number;
  appointmentsThisMonth: number;
  revenueThisMonth: number;
}

interface AppointmentByStatus {
  status: string;
  count: number;
}

interface AppointmentByType {
  consultationType: string;
  count: number;
}

interface RevenueByMonth {
  month: string;
  total: number;
}

interface TopDoctor {
  doctorId: string;
  name: string;
  totalPatients: number;
  rating: number;
}

interface RecentPayment {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  currency: string;
  patient: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
}

interface RecentAppointment {
  id: string;
  scheduledAt: string;
  status: string;
  consultationType: string;
  patient: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
  doctor: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
}

interface ReportData {
  overview: Overview;
  appointmentsByStatus: AppointmentByStatus[];
  appointmentsByType: AppointmentByType[];
  revenueByMonth: RevenueByMonth[];
  topDoctors: TopDoctor[];
  recentPayments: RecentPayment[];
  recentAppointments: RecentAppointment[];
}

// ─── Constants ───────────────────────────────────────────

type RangeKey = "week" | "month" | "3months" | "6months" | "year";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "3months", label: "Last 3 Months" },
  { key: "6months", label: "Last 6 Months" },
  { key: "year", label: "This Year" },
];

const PIE_COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626"];

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  REFUNDED: "bg-purple-100 text-purple-700",
};

// ─── Helpers ─────────────────────────────────────────────

function getDateRange(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  switch (key) {
    case "week":
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
        to: endOfWeek(now, { weekStartsOn: 1 }).toISOString(),
      };
    case "month":
      return {
        from: startOfMonth(now).toISOString(),
        to: endOfMonth(now).toISOString(),
      };
    case "3months":
      return {
        from: startOfMonth(subMonths(now, 2)).toISOString(),
        to: endOfMonth(now).toISOString(),
      };
    case "6months":
      return {
        from: startOfMonth(subMonths(now, 5)).toISOString(),
        to: endOfMonth(now).toISOString(),
      };
    case "year":
      return {
        from: startOfYear(now).toISOString(),
        to: endOfYear(now).toISOString(),
      };
  }
}

function formatCurrency(amount: number, currency?: string): string {
  if (currency === "NGN" || currency === "₦") {
    return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
  }
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function statusBadge(status: string) {
  const colorClass = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        colorClass
      )}
    >
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}

// ─── Component ──────────────────────────────────────────

export default function AdminReportsPage() {
  const [range, setRange] = useState<RangeKey>("month");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (rangeKey: RangeKey) => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getDateRange(rangeKey);
      const res = await fetch(
        `/api/admin/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      if (!res.ok) throw new Error("Failed to fetch reports");
      const json: ReportData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(range);
  }, [range, fetchReport]);

  // ─── CSV Export ─────────────────────────────────────────

  const handleExportCSV = () => {
    if (!data) return;

    const rows: string[][] = [];

    // Overview section
    rows.push(["--- Overview ---"]);
    rows.push(["Metric", "Value"]);
    rows.push(["Total Patients", String(data.overview.totalPatients)]);
    rows.push(["Total Doctors", String(data.overview.totalDoctors)]);
    rows.push(["Total Appointments", String(data.overview.totalAppointments)]);
    rows.push(["Total Revenue", String(data.overview.totalRevenue)]);
    rows.push([
      "Appointments This Month",
      String(data.overview.appointmentsThisMonth),
    ]);
    rows.push(["Revenue This Month", String(data.overview.revenueThisMonth)]);
    rows.push([]);

    // Appointments by status
    rows.push(["--- Appointments by Status ---"]);
    rows.push(["Status", "Count"]);
    data.appointmentsByStatus.forEach((item) => {
      rows.push([item.status, String(item.count)]);
    });
    rows.push([]);

    // Appointments by type
    rows.push(["--- Appointments by Type ---"]);
    rows.push(["Consultation Type", "Count"]);
    data.appointmentsByType.forEach((item) => {
      rows.push([item.consultationType, String(item.count)]);
    });

    const csvContent = rows
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `report-${range}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ─── Loading / Error states ─────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-lg text-gray-500">Loading reports...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-red-600 text-lg">{error ?? "No data available"}</p>
        <button
          onClick={() => fetchReport(range)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const { overview } = data;

  // ─── Metric cards config ────────────────────────────────

  const metrics = [
    {
      label: "Total Patients",
      value: overview.totalPatients.toLocaleString(),
      icon: Users,
      lightColor: "bg-blue-50",
      textColor: "text-blue-600",
    },
    {
      label: "Total Doctors",
      value: overview.totalDoctors.toLocaleString(),
      icon: Stethoscope,
      lightColor: "bg-emerald-50",
      textColor: "text-emerald-600",
    },
    {
      label: "Total Appointments",
      value: overview.totalAppointments.toLocaleString(),
      icon: CalendarDays,
      lightColor: "bg-violet-50",
      textColor: "text-violet-600",
    },
    {
      label: "Total Revenue",
      value: formatCurrency(overview.totalRevenue),
      icon: DollarSign,
      lightColor: "bg-amber-50",
      textColor: "text-amber-600",
    },
    {
      label: "Appointments This Month",
      value: overview.appointmentsThisMonth.toLocaleString(),
      icon: Activity,
      lightColor: "bg-pink-50",
      textColor: "text-pink-600",
    },
    {
      label: "Revenue This Month",
      value: formatCurrency(overview.revenueThisMonth),
      icon: TrendingUp,
      lightColor: "bg-cyan-50",
      textColor: "text-cyan-600",
    },
  ];

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* ── Header: Date range + Export ────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Analytics and insights for your organization
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                range === opt.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              )}
            >
              {opt.label}
            </button>
          ))}

          <button
            onClick={handleExportCSV}
            className="ml-2 inline-flex items-center gap-1.5 rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Row 1: Metric Cards ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  m.lightColor
                )}
              >
                <m.icon className={cn("h-5 w-5", m.textColor)} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 truncate">
                  {m.label}
                </p>
                <p className="text-lg font-bold text-gray-900 truncate">
                  {m.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Row 2: Appointments by Status + Type ───────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bar Chart — Appointments by Status */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Appointments by Status
            </h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.appointmentsByStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="status"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: string) =>
                    v.replace(/_/g, " ").toLowerCase()
                  }
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [value, "Count"]}
                  labelFormatter={(label) =>
                    String(label).replace(/_/g, " ").toLowerCase()
                  }
                />
                <Legend />
                <Bar
                  dataKey="count"
                  name="Appointments"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart — Consultation Type Breakdown */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Consultation Type Breakdown
            </h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.appointmentsByType}
                  dataKey="count"
                  nameKey="consultationType"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(props) =>
                    `${props.name ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {data.appointmentsByType.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [value, name]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Row 3: Revenue Over Months + Top Doctors ────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Area Chart — Revenue Over Months */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Revenue Over Time
            </h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueByMonth}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value) => [
                    formatCurrency(Number(value)),
                    "Revenue",
                  ]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Revenue"
                  stroke="#2563eb"
                  fill="url(#revenueGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Horizontal Bar Chart — Top 5 Doctors */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Top 5 Doctors by Patients
            </h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.topDoctors.slice(0, 5)}
                layout="vertical"
                margin={{ left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  width={120}
                />
                <Tooltip
                  formatter={(value) => [value, "Patients"]}
                />
                <Legend />
                <Bar
                  dataKey="totalPatients"
                  name="Patients"
                  fill="#2563eb"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Row 4: Recent Payments + Recent Appointments ──── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Payments */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Recent Payments
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-3 text-left font-medium text-gray-500">
                    Patient
                  </th>
                  <th className="pb-3 text-left font-medium text-gray-500">
                    Amount
                  </th>
                  <th className="pb-3 text-left font-medium text-gray-500">
                    Status
                  </th>
                  <th className="pb-3 text-left font-medium text-gray-500">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.recentPayments.slice(0, 10).map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50/50">
                    <td className="py-2.5 font-medium text-gray-900">
                      {payment.patient.user.firstName}{" "}
                      {payment.patient.user.lastName}
                    </td>
                    <td className="py-2.5 text-gray-700">
                      {formatCurrency(payment.amount, payment.currency)}
                    </td>
                    <td className="py-2.5">{statusBadge(payment.status)}</td>
                    <td className="py-2.5 text-gray-500">
                      {format(new Date(payment.createdAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))}
                {data.recentPayments.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-gray-400"
                    >
                      No recent payments
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Appointments */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Recent Appointments
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-3 text-left font-medium text-gray-500">
                    Patient
                  </th>
                  <th className="pb-3 text-left font-medium text-gray-500">
                    Doctor
                  </th>
                  <th className="pb-3 text-left font-medium text-gray-500">
                    Type
                  </th>
                  <th className="pb-3 text-left font-medium text-gray-500">
                    Status
                  </th>
                  <th className="pb-3 text-left font-medium text-gray-500">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.recentAppointments.slice(0, 10).map((appt) => (
                  <tr key={appt.id} className="hover:bg-gray-50/50">
                    <td className="py-2.5 font-medium text-gray-900">
                      {appt.patient.user.firstName}{" "}
                      {appt.patient.user.lastName}
                    </td>
                    <td className="py-2.5 text-gray-700">
                      Dr. {appt.doctor.user.firstName}{" "}
                      {appt.doctor.user.lastName}
                    </td>
                    <td className="py-2.5 text-gray-500 capitalize">
                      {appt.consultationType.replace(/_/g, " ").toLowerCase()}
                    </td>
                    <td className="py-2.5">{statusBadge(appt.status)}</td>
                    <td className="py-2.5 text-gray-500">
                      {format(new Date(appt.scheduledAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))}
                {data.recentAppointments.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-gray-400"
                    >
                      No recent appointments
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
