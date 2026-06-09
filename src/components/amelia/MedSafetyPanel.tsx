"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";

interface MedSafetyResult {
  interactions: { drugs: string[]; severity: string; note: string }[];
  dosingNotes: { medication: string; note: string }[];
  allergyConflicts: { medication: string; allergy: string; note: string }[];
  overallNote: string;
}

const SEVERITY_STYLE: Record<string, string> = {
  high: "bg-red-50 border-red-200 text-red-800",
  moderate: "bg-amber-50 border-amber-200 text-amber-800",
  low: "bg-gray-50 border-gray-200 text-gray-700",
};

export default function MedSafetyPanel() {
  const [result, setResult] = useState<MedSafetyResult | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/amelia/med-safety");
        const data = await res.json();
        if (!active) return;
        if (res.ok) {
          setResult(data.result);
          setState("ready");
        } else {
          setState("error");
        }
      } catch {
        if (active) setState("error");
      }
    })();
    return () => { active = false; };
  }, []);

  if (state === "loading") {
    return (
      <div className="mb-8 flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Amelia is reviewing your medications…
      </div>
    );
  }
  if (state === "error" || !result) {
    return <div className="mb-8 text-sm text-gray-400">Medication safety review is unavailable right now.</div>;
  }

  const hasConcerns = result.interactions.length > 0 || result.dosingNotes.length > 0 || result.allergyConflicts.length > 0;

  return (
    <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
        <h2 className="text-base font-semibold text-gray-900">Medication safety</h2>
      </div>
      {!hasConcerns ? (
        <p className="text-sm text-gray-500">No concerns found across your current medications.</p>
      ) : (
        <div className="space-y-2">
          {result.allergyConflicts.map((c, i) => (
            <div key={`a${i}`} className="rounded-xl border bg-red-50 border-red-200 text-red-800 px-3 py-2 text-sm">
              <span className="font-medium flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Allergy conflict: {c.medication}</span>
              <p className="mt-0.5">{c.note}</p>
            </div>
          ))}
          {result.interactions.map((it, i) => (
            <div key={`i${i}`} className={`rounded-xl border px-3 py-2 text-sm ${SEVERITY_STYLE[it.severity] ?? SEVERITY_STYLE.low}`}>
              <span className="font-medium capitalize">{it.severity} interaction: {it.drugs.join(" + ")}</span>
              <p className="mt-0.5">{it.note}</p>
            </div>
          ))}
          {result.dosingNotes.map((d, i) => (
            <div key={`d${i}`} className="rounded-xl border bg-gray-50 border-gray-200 text-gray-700 px-3 py-2 text-sm">
              <span className="font-medium">Dosing: {d.medication}</span>
              <p className="mt-0.5">{d.note}</p>
            </div>
          ))}
        </div>
      )}
      {result.overallNote && <p className="text-xs text-gray-400 mt-3">{result.overallNote}</p>}
    </section>
  );
}
