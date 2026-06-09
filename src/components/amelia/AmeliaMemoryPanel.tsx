"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, Trash2, Loader2 } from "lucide-react";

interface MemoryFact {
  id: string;
  kind: string;
  value: string;
  confirmedByUser: boolean;
}

const HIGH_STAKES = new Set(["ALLERGY", "CONDITION", "MEDICATION"]);
const KIND_LABEL: Record<string, string> = {
  ALLERGY: "Allergies",
  CONDITION: "Conditions",
  MEDICATION: "Medications",
  PREFERENCE: "Preferences",
  LIFESTYLE: "Lifestyle",
  OTHER: "Other",
};

export default function AmeliaMemoryPanel() {
  const [memories, setMemories] = useState<MemoryFact[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/amelia/memory");
      const data = await res.json();
      if (res.ok) setMemories(data.memories ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirm = async (id: string) => {
    await fetch(`/api/amelia/memory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });
    await load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/amelia/memory/${id}`, { method: "DELETE" });
    await load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  if (memories.length === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-12 px-4">
        Amelia hasn&apos;t learned anything yet — chat with her and she&apos;ll start remembering.
      </div>
    );
  }

  const groups = Object.keys(KIND_LABEL)
    .map((kind) => ({ kind, items: memories.filter((m) => m.kind === kind) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="overflow-y-auto px-4 py-4 space-y-6">
      {groups.map((g) => (
        <div key={g.kind}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{KIND_LABEL[g.kind]}</h3>
          <ul className="space-y-2">
            {g.items.map((m) => {
              const pending = HIGH_STAKES.has(m.kind) && !m.confirmedByUser;
              return (
                <li key={m.id} className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2">
                  <span className="flex-1 text-sm text-gray-800">{m.value}</span>
                  {pending ? (
                    <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">pending</span>
                  ) : (
                    <Check className="w-4 h-4 text-green-500" aria-label="confirmed" />
                  )}
                  {pending && (
                    <button
                      onClick={() => confirm(m.id)}
                      className="text-xs font-medium text-white bg-[var(--primary)] px-3 py-1 rounded-lg hover:opacity-90"
                    >
                      Confirm
                    </button>
                  )}
                  <button onClick={() => remove(m.id)} aria-label="Delete" className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
