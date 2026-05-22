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
} from "lucide-react";
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
  "bg-blue-500",
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
  CONFIRMED: "bg-blue-100 text-blue-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
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

// ─── Component ───────────────────────────────────────────

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search patients..."
                  className="pl-9 pr-4 py-2 w-64 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              {/* Total badge */}
              <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-xl">
                <Users className="w-4 h-4" />
                {total} {total === 1 ? "patient" : "patients"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Content ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
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
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition"
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
    </div>
  );
}
