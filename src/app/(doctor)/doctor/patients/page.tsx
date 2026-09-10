"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Users,
  Calendar,
  Loader2,
  Droplets,
  AlertTriangle,
  ClipboardList,
  CalendarPlus,
  UserPlus,
  X,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────

interface PatientUser {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email: string;
  phone: string | null;
}

interface LastAppointment {
  date: string;
  status: string;
}

interface Patient {
  id: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string | null;
  allergies: string[];
  user: PatientUser;
  lastAppointment: LastAppointment | null;
  totalAppointments: number;
}

interface PatientsResponse {
  patients: Patient[];
  total: number;
}

// ─── Helpers ─────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-[var(--primary)]",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-teal-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function calculateAge(dateOfBirth: string): number {
  return Math.floor(
    (Date.now() - new Date(dateOfBirth).getTime()) / 31557600000
  );
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  CONFIRMED: "bg-[var(--primary)]/10 text-[var(--primary)]",
  SCHEDULED: "bg-[var(--primary)]/10 text-[var(--primary)]",
  CANCELLED: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  NO_SHOW: "bg-gray-100 text-gray-700",
};

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function IntakePatientModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("male");
  const [bloodType, setBloodType] = useState("");
  const [allergies, setAllergies] = useState("");
  const [initialNotes, setInitialNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          dateOfBirth,
          gender,
          bloodType: bloodType.trim() || undefined,
          allergies: allergies
            ? allergies.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          initialNotes: initialNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to intake patient");
      }

      onSuccess(data.message || "Patient successfully registered in clinic directory");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[var(--primary)]/10 text-[var(--primary)] rounded-xl">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Intake / Register In-Person Patient</h2>
              <p className="text-xs text-gray-500">Record clinical history for a patient prior to self-registration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 leading-relaxed">
              <strong>Seamless Patient Claiming:</strong> When the patient signs up online with this email or phone number, their account will automatically claim all their clinical notes, vitals, prescriptions, and lab orders created here.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. John"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[var(--primary)] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Doe"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[var(--primary)] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="patient@example.com"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[var(--primary)] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0199"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[var(--primary)] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[var(--primary)] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Gender <span className="text-red-500">*</span>
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[var(--primary)] outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Blood Type
              </label>
              <input
                type="text"
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                placeholder="O+, A+, etc."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[var(--primary)] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Known Allergies (Comma-separated)
            </label>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="e.g. Penicillin, Peanuts"
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[var(--primary)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Initial Clinical Notes / Chief Complaint
            </label>
            <textarea
              rows={3}
              value={initialNotes}
              onChange={(e) => setInitialNotes(e.target.value)}
              placeholder="Record chief complaint, past medical history, or visit rationale..."
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[var(--primary)] outline-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--primary)] hover:opacity-95 text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Register Patient
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPatients = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const params = query ? `?search=${encodeURIComponent(query)}` : "";
      const res = await fetch(`/api/patients${params}`);
      if (res.ok) {
        const data: PatientsResponse = await res.json();
        setPatients(data.patients);
        setTotal(data.total);
      }
    } catch {
      // network error — leave current state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients("");
  }, [fetchPatients]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPatients(value);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ─── Header ─── */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Manage and view your patient records
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search patients..."
                  className="pl-9 pr-4 py-2 w-56 sm:w-64 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
                />
              </div>

              {/* Total badge */}
              <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--primary)]/10 text-[var(--primary)] text-sm font-medium rounded-xl">
                <Users className="w-4 h-4" />
                {total} {total === 1 ? "patient" : "patients"}
              </span>

              {/* Register In-Person Patient button */}
              <button
                onClick={() => setShowIntakeModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-[var(--primary)] hover:opacity-95 text-white text-sm font-semibold rounded-xl shadow-sm transition"
              >
                <UserPlus className="w-4 h-4" />
                Intake Patient
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Banner */}
      {bannerMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{bannerMessage}</span>
            </div>
            <button onClick={() => setBannerMessage(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Content ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="py-4">
            <TableRowsSkeleton rows={6} />
          </div>
        ) : patients.length === 0 ? (
          /* ─── Empty State ─── */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <Users className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No patients yet
            </h3>
            <p className="text-gray-500 text-sm max-w-md">
              Patients who book appointments with you will appear here.
            </p>
          </div>
        ) : (
          /* ─── Patient Grid ─── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map((patient) => {
              const { user, allergies, lastAppointment, totalAppointments } =
                patient;
              const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
              const fullName = `${user.firstName} ${user.lastName}`;
              const avatarBg = getAvatarColor(fullName);
              const age = calculateAge(patient.dateOfBirth);

              return (
                <div
                  key={patient.id}
                  className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow"
                >
                  {/* Name + Avatar */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={cn(
                        "w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0",
                        avatarBg
                      )}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {fullName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {age} yrs &middot; {patient.gender}
                      </p>
                    </div>
                  </div>

                  {/* Blood type + Allergies */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-4">
                    {patient.bloodType && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                        <Droplets className="w-3 h-3" />
                        {patient.bloodType}
                      </span>
                    )}
                    {allergies.slice(0, 2).map((allergy) => (
                      <span
                        key={allergy}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 text-xs font-medium rounded-full"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {allergy}
                      </span>
                    ))}
                    {allergies.length > 2 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                        +{allergies.length - 2} more
                      </span>
                    )}
                  </div>

                  {/* Last appointment */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Last appointment</span>
                    <span className="flex items-center gap-1">
                      <ClipboardList className="w-3 h-3" />
                      {totalAppointments} total
                    </span>
                  </div>
                  {lastAppointment ? (
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs text-gray-700 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {format(new Date(lastAppointment.date), "MMM d, yyyy")}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 text-xs font-medium rounded-full",
                          STATUS_COLORS[lastAppointment.status] ||
                            "bg-gray-100 text-gray-700"
                        )}
                      >
                        {formatStatus(lastAppointment.status)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mb-4">
                      No appointments yet
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/doctor/patients/${patient.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--primary)] hover:opacity-90 text-white text-xs font-medium rounded-lg transition"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      View Records
                    </Link>
                    <Link
                      href={`/doctor/appointments?patientId=${patient.id}&action=book`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      Book Appointment
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Intake Patient Modal */}
      <IntakePatientModal
        isOpen={showIntakeModal}
        onClose={() => setShowIntakeModal(false)}
        onSuccess={(msg) => {
          setBannerMessage(msg);
          fetchPatients("");
        }}
      />
    </div>
  );
}
