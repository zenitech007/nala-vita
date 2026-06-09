"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import AmeliaChat from "./AmeliaChat";

export default function AmeliaLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[90vw] max-w-sm h-[70vh] rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between bg-[var(--primary)] text-white px-4 py-3">
            <span className="flex items-center gap-2 font-semibold text-sm"><Sparkles className="w-4 h-4" /> Amelia</span>
            <button aria-label="Close Amelia" onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 min-h-0"><AmeliaChat /></div>
        </div>
      )}
      <button
        aria-label="Ask Amelia"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[var(--primary)] text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
      >
        <Sparkles className="w-6 h-6" />
      </button>
    </>
  );
}
