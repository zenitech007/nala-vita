"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, X, PanelRightOpen, Minimize2 } from "lucide-react";
import AmeliaChat from "./AmeliaChat";

export interface AmeliaLauncherProps {
  role?: "patient" | "doctor" | "admin";
}

export default function AmeliaLauncher({ role = "patient" }: AmeliaLauncherProps) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const [chatKey] = useState(0);

  const quickPrompts =
    role === "doctor"
      ? [
          { label: "Check drug interactions", prompt: "Can you analyze potential drug-drug interactions for antibiotics with statins?" },
          { label: "Summarize patient vitals", prompt: "How should I interpret borderline hypertension with elevated resting heart rate?" },
          { label: "Clinical differentials", prompt: "What are the common differentials for persistent dry cough with mild nocturnal fever?" },
        ]
      : [
          { label: "Check my symptoms", prompt: "I am feeling a dull headache and mild fatigue since yesterday. What could this mean?" },
          { label: "Explain my lab results", prompt: "Could you help explain common blood test markers like HbA1c and lipid panel?" },
          { label: "Medication advice", prompt: "What should I do if I missed a dose of my morning prescribed medication?" },
        ];

  const handleSelectPrompt = (promptText: string) => {
    if (!open) setOpen(true);
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        'input[aria-label="Message Amelia"], input[placeholder*="Ask Amelia"]'
      );
      if (input) {
        input.value = promptText;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      }
    }, 150);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            {isDocked ? (
              // ─── DOCKED DRAWER MODE (Sticky Right Drawer) ───────────────────
              <motion.aside
                initial={reducedMotion ? false : { x: "100%" }}
                animate={{ x: 0 }}
                exit={reducedMotion ? undefined : { x: "100%" }}
                transition={reducedMotion ? { duration: 0 } : { type: "spring", damping: 28, stiffness: 220 }}
                className="fixed inset-y-0 right-0 z-50 w-[440px] max-w-full h-dvh bg-white dark:bg-[#1E1F22] shadow-2xl border-l border-gray-200 dark:border-gray-800 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between bg-[var(--primary)] text-white px-4 py-3 shrink-0">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span>Amelia AI Assistant</span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-normal">
                      Docked
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Switch to Floating Window"
                      aria-label="Switch to Floating Window"
                      onClick={() => setIsDocked(false)}
                      className="p-1.5 rounded-lg hover:bg-white/20 transition text-white"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Close Amelia"
                      onClick={() => setOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-white/20 transition text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Quick Prompts Rail */}
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
                  <span className="text-gray-400 shrink-0 font-medium mr-1">Suggested:</span>
                  {quickPrompts.map((qp, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectPrompt(qp.prompt)}
                      className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-[var(--primary)] hover:text-[var(--primary)] transition text-[11px] font-medium text-gray-600 dark:text-gray-300 shadow-2xs"
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>

                {/* Chat transcript */}
                <div className="flex-1 min-h-0">
                  <AmeliaChat key={`docked-${chatKey}`} collapsibleHistory={false} overlayHistory={true} />
                </div>
              </motion.aside>
            ) : (
              // ─── FLOATING CARD MODE (Default Light Widget) ─────────────────
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: reducedMotion ? 0 : 0.2 }}
                className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[400px] h-[72dvh] max-h-[min(640px,calc(100dvh-7rem))] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col bg-white dark:bg-[#1E1F22]"
              >
                {/* Header */}
                <div className="flex items-center justify-between bg-[var(--primary)] text-white px-4 py-3 shrink-0">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Sparkles className="w-4 h-4" />
                    <span>Amelia AI Assistant</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Dock to Right Side"
                      aria-label="Dock to Right Side"
                      onClick={() => setIsDocked(true)}
                      className="p-1.5 rounded-lg hover:bg-white/20 transition text-white"
                    >
                      <PanelRightOpen className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Close Amelia"
                      onClick={() => setOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-white/20 transition text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Quick Prompts Rail */}
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
                  {quickPrompts.map((qp, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectPrompt(qp.prompt)}
                      className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-[var(--primary)] hover:text-[var(--primary)] transition text-[11px] font-medium text-gray-600 dark:text-gray-300"
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>

                {/* Chat transcript */}
                <div className="flex-1 min-h-0">
                  <AmeliaChat key={`float-${chatKey}`} overlayHistory />
                </div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Launcher Floating Action Button (Only show when closed or floating) */}
      {(!open || !isDocked) && (
        <motion.button
          whileHover={reducedMotion ? undefined : { scale: 1.05 }}
          whileTap={reducedMotion ? undefined : { scale: 0.95 }}
          aria-label={open ? "Close Amelia" : "Ask Amelia AI"}
          onClick={() => setOpen((v) => !v)}
          className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[var(--primary)] text-white shadow-xl hover:shadow-2xl transition-all flex items-center justify-center ${
            open ? "ring-4 ring-[var(--primary)]/30" : ""
          }`}
        >
          {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6 motion-safe:animate-pulse" />}
        </motion.button>
      )}
    </>
  );
}
