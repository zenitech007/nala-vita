"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Trash2, Loader2 } from "lucide-react";

interface ReminderRecord {
  id: string;
  kind: string;
  label: string;
  frequency: string;
  nextFireAt: string;
  schedule: string;
}

export default function AmeliaRemindersPanel() {
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/amelia/reminders");
      const data = await res.json();
      if (res.ok) setReminders(data.reminders ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cancel = async (id: string) => {
    await fetch(`/api/amelia/reminders/${id}`, { method: "DELETE" });
    await load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  if (reminders.length === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-12 px-4">
        No reminders yet — just ask Amelia to remind you about anything.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto px-4 py-4 space-y-2">
      {reminders.map((r) => (
        <div key={r.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2">
          <Bell className="w-4 h-4 text-[var(--primary)] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800">{r.label}</p>
            <p className="text-xs text-gray-400">{r.schedule}</p>
          </div>
          <button onClick={() => cancel(r.id)} aria-label="Cancel" className="p-1 text-gray-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
