"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  Brain,
  Wind,
  Phone,
  AlertTriangle,
  CheckCircle,
  SmilePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, parseISO } from "date-fns";
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

interface MoodEntry {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

interface ParsedMoodEntry {
  id: string;
  date: string;
  dateFormatted: string;
  mood: number;
  note: string;
  createdAt: string;
}

interface ChartDataPoint {
  date: string;
  mood: number;
  note: string;
}

// ─── Constants ───────────────────────────────────────────

const MOOD_EMOJIS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: "\ud83d\ude14", label: "Very low" },
  2: { emoji: "\ud83d\ude22", label: "Sad" },
  3: { emoji: "\ud83d\ude1f", label: "Worried" },
  4: { emoji: "\ud83d\ude10", label: "Meh" },
  5: { emoji: "\ud83d\ude42", label: "Okay" },
  6: { emoji: "\ud83d\ude0a", label: "Good" },
  7: { emoji: "\ud83d\ude04", label: "Happy" },
  8: { emoji: "\ud83d\ude03", label: "Great" },
  9: { emoji: "\ud83e\udd29", label: "Amazing" },
  10: { emoji: "\ud83c\udf1f", label: "Excellent" },
};

function getMoodColor(mood: number): string {
  if (mood <= 3) return "text-red-600";
  if (mood <= 6) return "text-amber-600";
  return "text-green-600";
}

function getMoodBgColor(mood: number): string {
  if (mood <= 3) return "bg-red-100 text-red-700";
  if (mood <= 6) return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
}

function getMoodDotFill(mood: number): string {
  if (mood <= 3) return "#ef4444";
  if (mood <= 6) return "#f59e0b";
  return "#22c55e";
}

function parseMoodEntries(entries: MoodEntry[]): ParsedMoodEntry[] {
  return entries
    .map((entry) => {
      try {
        const parsed = JSON.parse(entry.content) as { mood: number; note?: string };
        const createdDate = parseISO(entry.createdAt);
        return {
          id: entry.id,
          date: format(createdDate, "MMM d"),
          dateFormatted: format(createdDate, "MMM d, yyyy"),
          mood: parsed.mood,
          note: parsed.note || "",
          createdAt: entry.createdAt,
        };
      } catch {
        return null;
      }
    })
    .filter((e): e is ParsedMoodEntry => e !== null);
}

// ─── Custom chart tooltip ────────────────────────────────

function MoodTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; payload: ChartDataPoint }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  const mood = point.value;
  const info = MOOD_EMOJIS[mood] || MOOD_EMOJIS[5];
  return (
    <div className="bg-white shadow-lg border border-gray-200 rounded-xl px-4 py-3 text-sm">
      <p className="font-medium text-gray-900">{label}</p>
      <p className={cn("font-semibold", getMoodColor(mood))}>
        {info.emoji} {mood}/10 &mdash; {info.label}
      </p>
      {point.payload.note && (
        <p className="text-xs text-gray-500 mt-1 max-w-[200px] truncate">
          {point.payload.note}
        </p>
      )}
    </div>
  );
}

// ─── Custom dot renderer ─────────────────────────────────

function MoodDot(props: {
  cx?: number;
  cy?: number;
  payload?: ChartDataPoint;
}) {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={getMoodDotFill(payload.mood)}
      stroke="#fff"
      strokeWidth={2}
    />
  );
}

// ─── Breathing Exercise Component ────────────────────────

function BreathingExercise() {
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [_seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isRunning) return;

    setPhase("inhale");
    setSeconds(0);

    const interval = setInterval(() => {
      setSeconds((prev) => {
        const next = prev + 1;
        // 4s inhale, 7s hold, 8s exhale = 19s total cycle
        const cyclePos = next % 19;
        if (cyclePos < 4) {
          setPhase("inhale");
        } else if (cyclePos < 11) {
          setPhase("hold");
        } else {
          setPhase("exhale");
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const breathingKeyframes = `
    @keyframes breatheCircle {
      0% { transform: scale(0.6); }
      21.05% { transform: scale(1); }
      57.89% { transform: scale(1); }
      100% { transform: scale(0.6); }
    }
  `;

  return (
    <div className="flex flex-col items-center gap-4">
      <style>{breathingKeyframes}</style>
      <div className="relative w-32 h-32 flex items-center justify-center">
        <div
          className={cn(
            "w-24 h-24 rounded-full bg-[var(--primary)]/30 flex items-center justify-center transition-all",
            !isRunning && "scale-75 opacity-50"
          )}
          style={
            isRunning
              ? {
                  animation: "breatheCircle 19s ease-in-out infinite",
                }
              : undefined
          }
        >
          <div className="w-16 h-16 rounded-full bg-blue-400 flex items-center justify-center">
            <Wind className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>
      {isRunning && (
        <p className="text-sm font-medium text-[var(--primary)] capitalize">
          {phase === "inhale"
            ? "Breathe in... (4s)"
            : phase === "hold"
            ? "Hold... (7s)"
            : "Breathe out... (8s)"}
        </p>
      )}
      <button
        onClick={() => setIsRunning(!isRunning)}
        className={cn(
          "px-5 py-2 rounded-xl text-sm font-semibold transition",
          isRunning
            ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
            : "bg-[var(--primary)] text-white hover:opacity-90"
        )}
      >
        {isRunning ? "Stop" : "Start Breathing Exercise"}
      </button>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────

export default function MentalHealthPage() {
  const [entries, setEntries] = useState<ParsedMoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const hasLoggedToday = entries.some((e) => {
    try {
      return isToday(parseISO(e.createdAt));
    } catch {
      return false;
    }
  });

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/mental-health");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: MoodEntry[] = await res.json();
      setEntries(parseMoodEntries(data));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSubmit = async () => {
    if (!selectedMood || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/mental-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: selectedMood, note }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to log mood");
      }

      setSubmitSuccess(true);
      setSelectedMood(null);
      setNote("");
      await fetchEntries();

      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prepare chart data — reverse so oldest is first (API returns desc)
  const chartData: ChartDataPoint[] = [...entries]
    .reverse()
    .map((e) => ({
      date: e.date,
      mood: e.mood,
      note: e.note,
    }));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <Link
              href="/patient/dashboard"
              className="text-gray-400 hover:text-gray-600"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Mental Health
              </h1>
              <p className="text-gray-500 text-sm">
                Track your mood and access wellness resources
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ─── Section 1: Daily Mood Check-in ─── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
              <SmilePlus className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              How are you feeling today?
            </h2>
          </div>

          {hasLoggedToday && !submitSuccess ? (
            <div className="flex items-center gap-3 py-6 px-4 bg-green-50 rounded-xl border border-green-200">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-green-700 font-medium">
                Already logged today. Come back tomorrow to track your mood
                again.
              </p>
            </div>
          ) : submitSuccess ? (
            <div className="flex items-center gap-3 py-6 px-4 bg-green-50 rounded-xl border border-green-200">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-green-700 font-medium">
                Mood logged successfully! Keep up the self-care.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Mood buttons */}
              <div>
                <p className="text-sm text-gray-500 mb-3">
                  Select a number from 1 (very low) to 10 (excellent)
                </p>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
                    const info = MOOD_EMOJIS[num];
                    const isSelected = selectedMood === num;
                    return (
                      <button
                        key={num}
                        onClick={() => setSelectedMood(num)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition hover:scale-105",
                          isSelected
                            ? "border-[var(--primary)] bg-[var(--primary)]/10 shadow-md"
                            : "border-gray-100 bg-white hover:border-gray-300"
                        )}
                      >
                        <span className="text-2xl">{info.emoji}</span>
                        <span
                          className={cn(
                            "text-xs font-medium",
                            isSelected ? "text-[var(--primary)]" : "text-gray-500"
                          )}
                        >
                          {num}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {selectedMood && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected:{" "}
                    <span className={cn("font-semibold", getMoodColor(selectedMood))}>
                      {selectedMood}/10 &mdash;{" "}
                      {MOOD_EMOJIS[selectedMood].label}
                    </span>
                  </p>
                )}
              </div>

              {/* Note textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  What&apos;s on your mind?{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Write about how you're feeling, what happened today..."
                  rows={3}
                  maxLength={2000}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none text-sm resize-none"
                />
              </div>

              {/* Error */}
              {submitError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {submitError}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!selectedMood || isSubmitting}
                className="px-6 py-3 bg-[var(--primary)] hover:opacity-90 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Logging...
                  </>
                ) : (
                  "Log Mood"
                )}
              </button>
            </div>
          )}
        </div>

        {/* ─── Section 2: Mood Trend Chart ─── */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Mood Trend &mdash; Last 30 Days
              </h2>
              <p className="text-sm text-gray-500">
                Your mood score over time
              </p>
            </div>

            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis
                    domain={[1, 10]}
                    ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <Tooltip content={<MoodTooltip />} />
                  <ReferenceLine
                    y={4}
                    stroke="#f59e0b"
                    strokeDasharray="5 5"
                    label={{
                      value: "Warning",
                      position: "right",
                      fill: "#f59e0b",
                      fontSize: 11,
                    }}
                  />
                  <ReferenceLine
                    y={7}
                    stroke="#22c55e"
                    strokeDasharray="5 5"
                    label={{
                      value: "Good",
                      position: "right",
                      fill: "#22c55e",
                      fontSize: 11,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="mood"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={<MoodDot />}
                    activeDot={{ r: 6, fill: "#2563eb" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ─── Section 3: Mood History List ─── */}
        {entries.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Mood History
            </h2>
            <div className="divide-y divide-gray-100">
              {entries.slice(0, 10).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="flex-shrink-0 text-sm text-gray-500 w-24">
                    {entry.dateFormatted}
                  </div>
                  <div
                    className={cn(
                      "flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold",
                      getMoodBgColor(entry.mood)
                    )}
                  >
                    {MOOD_EMOJIS[entry.mood]?.emoji} {entry.mood}/10
                  </div>
                  <p className="text-sm text-gray-600 truncate min-w-0">
                    {entry.note
                      ? entry.note.length > 100
                        ? entry.note.slice(0, 100) + "..."
                        : entry.note
                      : "No note"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Section 4: Resources ─── */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Wellness Resources
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Card 1: Talk to a therapist */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-4">
                <Brain className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Talk to a Therapist
              </h3>
              <p className="text-sm text-gray-500 mb-4 flex-1">
                Connect with a mental health professional through our secure
                chat. Get support, guidance, and a safe space to share.
              </p>
              <Link
                href="/patient/chat"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:text-[var(--primary)] transition"
              >
                Start a conversation
                <ChevronLeft className="w-4 h-4 rotate-180" />
              </Link>
            </div>

            {/* Card 2: Breathing exercise */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center mb-4">
                <Wind className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Breathing Exercise
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Try the 4-7-8 breathing technique to calm your mind and reduce
                anxiety. Inhale for 4 seconds, hold for 7, exhale for 8.
              </p>
              <BreathingExercise />
            </div>

            {/* Card 3: Crisis support */}
            <div className="bg-white rounded-2xl border-2 border-red-500 p-6 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                URGENT
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center mb-4">
                <Phone className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-semibold text-red-700 mb-1">
                Crisis Support
              </h3>
              <p className="text-sm text-gray-700 mb-4 flex-1">
                If you are in crisis, please call or text a crisis line. You are
                not alone and help is available 24/7.
              </p>
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-bold text-red-700">
                    Nigeria
                  </span>
                </div>
                <a
                  href="tel:08001234567"
                  className="text-lg font-bold text-red-700 hover:text-red-800 transition"
                >
                  Call 0800-SAFELINE
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
