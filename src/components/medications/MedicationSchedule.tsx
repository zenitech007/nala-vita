import { Pill, Clock, Calendar } from "lucide-react";

interface Medication {
  id?: string;
  name: string;
  dosage: string;
  frequency: string;
  instructions?: string;
}

interface Props {
  medications: Medication[];
}

export default function MedicationSchedule({ medications }: Props) {
  return (
    <div className="p-4 space-y-4 bg-gray-50 dark:bg-[#1E1F22] rounded-xl border border-gray-100 dark:border-gray-800">
      <h3 className="flex items-center gap-2 font-bold text-[var(--primary)]">
        <Pill size={20} /> Active Prescriptions
      </h3>

      {medications.length === 0 ? (
        <p className="text-sm text-gray-500">No active medications detected yet.</p>
      ) : (
        medications.map((med, idx) => (
          <div
            key={med.id ?? med.name + idx}
            className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border-l-4 border-[var(--primary)]"
          >
            <div className="flex justify-between items-start">
              <span className="font-bold text-gray-800 dark:text-gray-100">{med.name}</span>
              <span className="text-xs font-medium px-2 py-1 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full">
                {med.dosage}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock size={14} /> {med.frequency}
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={14} /> Daily
              </span>
            </div>

            {med.instructions && (
              <p className="mt-2 text-[10px] italic text-gray-400">Note: {med.instructions}</p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
