"use client";

import { useState } from "react";
import {
  Droplets,
  Pill,
  Activity,
  CalendarDays,
  Plus,
  Minus,
  CheckCircle2,
} from "lucide-react";

export interface DailyVitals {
  waterLiters: number;
  steps: number;
  medsTaken: boolean;
}

interface Props {
  initialVitals?: DailyVitals;
  onUpdate?: (vitals: DailyVitals) => Promise<void> | void;
}

const DEFAULT_VITALS: DailyVitals = {
  waterLiters: 0,
  steps: 0,
  medsTaken: false,
};

const WATER_GOAL = 2.5;

export default function HealthDashboard({ initialVitals, onUpdate }: Props) {
  const [vitals, setVitals] = useState<DailyVitals>(initialVitals ?? DEFAULT_VITALS);

  const persist = async (next: DailyVitals) => {
    setVitals(next);
    if (onUpdate) await onUpdate(next);
  };

  const handleWater = (amount: number) => {
    const newAmount = Math.max(0, Number((vitals.waterLiters + amount).toFixed(2)));
    void persist({ ...vitals, waterLiters: newAmount });
  };

  const toggleMeds = () => {
    void persist({ ...vitals, medsTaken: !vitals.medsTaken });
  };

  const setSteps = (n: number) => {
    void persist({ ...vitals, steps: n });
  };

  const waterPercent = Math.min(100, (vitals.waterLiters / WATER_GOAL) * 100);
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="bg-white dark:bg-[#1E1F22] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity size={22} className="text-[var(--primary)]" /> Daily Vitals
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
            <CalendarDays size={14} /> {todayLabel}
          </p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* HYDRATION WIDGET (Spans full width) */}
          <div className="col-span-2 bg-gray-50 dark:bg-[#14151A] rounded-3xl p-5 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-blue-500 dark:text-blue-400 font-semibold">
                <Droplets size={20} /> Hydration
              </div>
              <span className="text-2xl font-bold text-gray-800 dark:text-white">
                {vitals.waterLiters}
                <span className="text-sm text-gray-400 font-medium"> / {WATER_GOAL}L</span>
              </span>
            </div>

            <div className="h-4 w-full bg-blue-50 dark:bg-gray-800 rounded-full overflow-hidden mb-6 relative border border-blue-100 dark:border-gray-700">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-1000 ease-out"
                style={{ width: `${waterPercent}%` }}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleWater(-0.25)}
                disabled={vitals.waterLiters <= 0}
                aria-label="Remove 250ml"
                className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                <Minus size={20} />
              </button>
              <button
                onClick={() => handleWater(0.25)}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-semibold rounded-xl transition-colors py-3"
              >
                <Plus size={18} /> Add 250ml
              </button>
            </div>
          </div>

          {/* MEDICATION WIDGET */}
          <div
            role="button"
            tabIndex={0}
            onClick={toggleMeds}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleMeds();
              }
            }}
            className={`col-span-1 rounded-3xl p-5 border shadow-sm cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between min-h-[8.75rem] ${
              vitals.medsTaken
                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50"
                : "bg-gray-50 dark:bg-[#14151A] border-gray-100 dark:border-gray-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <div
                className={`p-2 rounded-full ${
                  vitals.medsTaken
                    ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-200"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                }`}
              >
                <Pill size={20} />
              </div>
              {vitals.medsTaken && <CheckCircle2 size={20} className="text-emerald-500" />}
            </div>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white mb-1">Medication</h3>
              <p
                className={`text-xs font-medium ${
                  vitals.medsTaken
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-gray-400"
                }`}
              >
                {vitals.medsTaken ? "Taken today" : "Tap to log"}
              </p>
            </div>
          </div>

          {/* STEPS WIDGET */}
          <div className="col-span-1 bg-gray-50 dark:bg-[#14151A] rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between min-h-[8.75rem]">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-500">
                <Activity size={20} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1 mb-1">
                <input
                  type="number"
                  value={vitals.steps || ""}
                  onChange={(e) => setSteps(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  aria-label="Daily steps"
                  className="w-full bg-transparent font-bold text-2xl text-gray-800 dark:text-white outline-none placeholder-gray-300 dark:placeholder-gray-700"
                />
              </div>
              <p className="text-xs font-medium text-gray-400">Daily Steps</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
