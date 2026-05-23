import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "neutral" | "warning" | "success";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { direction: "up" | "down" | "flat"; value: string };
  tone?: Tone;
}

const TONE_CLASSES: Record<Tone, string> = {
  primary: "bg-[var(--primary)]/10 text-[var(--primary)]",
  neutral: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
  warning: "bg-amber-100 text-amber-700",
  success: "bg-emerald-100 text-emerald-700",
};

const TREND_GLYPH = { up: "↑", down: "↓", flat: "→" } as const;
const TREND_COLOR = {
  up: "text-emerald-600",
  down: "text-red-600",
  flat: "text-gray-500",
} as const;

export function MetricCard({
  label,
  value,
  icon,
  trend,
  tone = "neutral",
}: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1E1F22] p-5 shadow-sm">
      <div className="flex items-center gap-3">
        {icon && (
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", TONE_CLASSES[tone])}>
            {icon}
          </div>
        )}
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
      {trend && (
        <p className={cn("text-xs font-medium mt-1 flex items-center gap-1", TREND_COLOR[trend.direction])}>
          <span aria-hidden>{TREND_GLYPH[trend.direction]}</span>
          <span>{trend.value}</span>
        </p>
      )}
    </div>
  );
}
