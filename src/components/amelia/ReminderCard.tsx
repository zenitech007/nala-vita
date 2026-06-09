"use client";

import { useState } from "react";
import { BellPlus, Check } from "lucide-react";

export interface ReminderSuggestionUI {
  kind: string;
  label: string;
  frequency: string;
  nextFireAt: string;
  schedule: string;
}

export default function ReminderCard({ suggestion }: { suggestion: ReminderSuggestionUI }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "dismissed">("idle");

  const setReminder = async () => {
    setState("saving");
    try {
      const res = await fetch("/api/amelia/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: suggestion.kind,
          label: suggestion.label,
          frequency: suggestion.frequency,
          nextFireAt: suggestion.nextFireAt,
        }),
      });
      setState(res.ok ? "done" : "idle");
    } catch {
      setState("idle");
    }
  };

  if (state === "dismissed") return null;

  return (
    <div className="mx-2 my-1 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 px-4 py-3">
      {state === "done" ? (
        <p className="flex items-center gap-2 text-sm text-green-700">
          <Check className="w-4 h-4" /> Reminder set — {suggestion.schedule}.
        </p>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm text-gray-800 mb-2">
            <BellPlus className="w-4 h-4 text-[var(--primary)]" />
            Remind you to <span className="font-medium">{suggestion.label}</span>, {suggestion.schedule}?
          </p>
          <div className="flex gap-2">
            <button
              onClick={setReminder}
              disabled={state === "saving"}
              className="text-xs font-medium text-white bg-[var(--primary)] px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {state === "saving" ? "Setting…" : "Set reminder"}
            </button>
            <button
              onClick={() => setState("dismissed")}
              className="text-xs font-medium text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100"
            >
              Not now
            </button>
          </div>
        </>
      )}
    </div>
  );
}
