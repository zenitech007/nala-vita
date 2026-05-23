"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pill, Clock, Plus, Activity, Info } from "lucide-react";

export interface MedicationInput {
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  instructions?: string;
}

interface AddMedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (medication: MedicationInput) => Promise<void>;
}

const inputClass =
  "w-full px-4 py-3 bg-gray-50 dark:bg-[#121315] border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10 transition-all";
const labelClass =
  "block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider";

export default function AddMedicationModal({ isOpen, onClose, onAdd }: AddMedicationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("Once daily");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [instructions, setInstructions] = useState("");

  // Dynamically adjust the number of time inputs based on frequency
  useEffect(() => {
    if (frequency === "Once daily") setTimes((t) => [t[0] || "08:00"]);
    if (frequency === "Twice daily") setTimes((t) => [t[0] || "08:00", t[1] || "20:00"]);
    if (frequency === "Three times daily")
      setTimes((t) => [t[0] || "08:00", t[1] || "14:00", t[2] || "20:00"]);
  }, [frequency]);

  const handleTimeChange = (index: number, newTime: string) => {
    setTimes((prev) => {
      const updated = [...prev];
      updated[index] = newTime;
      return updated;
    });
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!name.trim() || !dosage.trim()) return;

    setIsSubmitting(true);

    await onAdd({
      name,
      dosage,
      frequency,
      times,
      instructions: instructions || undefined,
    });

    // Reset and close
    setIsSubmitting(false);
    setName("");
    setDosage("");
    setFrequency("Once daily");
    setInstructions("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", bounce: 0.4, duration: 0.5 }}
              className="w-full max-w-lg bg-white dark:bg-[#1E1F22] rounded-3xl shadow-2xl border border-gray-100 dark:border-white/5 pointer-events-auto overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add Medication</h2>
                    <p className="text-xs text-gray-500">Track your own vitamins or prescriptions.</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-3 rounded-xl flex items-start gap-3">
                  <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                    Medications added here are managed by you. They will appear on your daily schedule,
                    but your doctor will see them marked as &quot;Self-Reported&quot;.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className={labelClass}>Medication Name</label>
                    <div className="relative">
                      <Pill size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        required
                        placeholder="e.g., Vitamin C"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className={labelClass}>Dosage</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., 500mg or 2 pills"
                      value={dosage}
                      onChange={(e) => setDosage(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className={inputClass}
                  >
                    <option value="Once daily">Once daily</option>
                    <option value="Twice daily">Twice daily</option>
                    <option value="Three times daily">Three times daily</option>
                    <option value="As needed">As needed (PRN)</option>
                  </select>
                </div>

                {frequency !== "As needed" && (
                  <div className="p-4 bg-gray-50 dark:bg-[#14151A] rounded-2xl border border-gray-100 dark:border-gray-800">
                    <label className={labelClass}>Scheduled Times</label>
                    <div className="space-y-3 mt-3">
                      {times.map((time, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="bg-white dark:bg-[#1E1F22] border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-xl flex items-center gap-3 flex-1 shadow-sm">
                            <Clock size={16} className="text-[var(--primary)]" />
                            <input
                              type="time"
                              required
                              value={time}
                              onChange={(e) => handleTimeChange(index, e.target.value)}
                              className="bg-transparent text-sm font-bold focus:outline-none dark:text-white w-full"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className={labelClass}>Notes / Instructions (Optional)</label>
                  <textarea
                    placeholder="e.g., Take with food"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className={`${inputClass} resize-none h-20`}
                  />
                </div>
              </form>

              <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/2 flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !name || !dosage}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[var(--primary)] hover:opacity-90 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-[var(--primary)]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Activity size={18} className="animate-spin" /> : <Plus size={18} />}
                  {isSubmitting ? "Saving..." : "Add to Schedule"}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
