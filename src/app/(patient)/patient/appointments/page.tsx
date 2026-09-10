"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  Plus,
  Search,
  X,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Stethoscope,
  CreditCard,
  ChevronLeft,
  Filter,
} from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────

type TabKey = "upcoming" | "past" | "cancelled";

interface AppointmentDoctor {
  id: string;
  specialization: string;
  consultationFee: number;
  user: { firstName: string; lastName: string; avatarUrl: string | null };
}

interface Appointment {
  id: string;
  scheduledAt: string;
  duration: number;
  status: string;
  consultationType: string;
  urgencyLevel: string;
  reason: string | null;
  notes: string | null;
  doctor: AppointmentDoctor;
}

interface DoctorOption {
  id: string;
  specialization: string;
  consultationFee: number;
  rating: number;
  availableDays: string[];
  availableFrom: string | null;
  availableTo: string | null;
  user: { firstName: string; lastName: string; avatarUrl: string | null };
}

// ─── Booking Modal Steps ─────────────────────────────────

type BookingStep = 1 | 2 | 3 | 4 | 5;

const SPECIALITIES = [
  "All",
  "General Practice",
  "Cardiology",
  "Dermatology",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Psychiatry",
  "Oncology",
  "Gynecology",
  "ENT",
];

const TIME_SLOTS = [
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "01:00 PM",
  "01:30 PM",
  "02:00 PM",
  "02:30 PM",
  "03:00 PM",
  "03:30 PM",
  "04:00 PM",
  "04:30 PM",
  "05:00 PM",
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  SCHEDULED: { label: "Scheduled", color: "bg-[var(--primary)]/10 text-[var(--primary)]", icon: Clock },
  CONFIRMED: { label: "Confirmed", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  IN_PROGRESS: { label: "In Progress", color: "bg-violet-100 text-violet-700", icon: AlertCircle },
  COMPLETED: { label: "Completed", color: "bg-gray-100 text-gray-600", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: XCircle },
  NO_SHOW: { label: "No Show", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
};

export default function PatientAppointmentsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("upcoming");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showBooking, setShowBooking] = useState(false);

  // Check URL param for auto-open
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "book") setShowBooking(true);
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/appointments?status=${activeTab}`);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Unable to load appointments");
      }

      if (!Array.isArray(data?.appointments)) {
        throw new Error("The appointments response was invalid");
      }

      setAppointments(data.appointments);
    } catch (error) {
      setAppointments([]);
      setLoadError(
        error instanceof Error ? error.message : "Unable to load appointments"
      );
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const tabs: { key: TabKey; label: string; count: number | null }[] = [
    { key: "upcoming", label: "Upcoming", count: activeTab === "upcoming" ? appointments.length : null },
    { key: "past", label: "Past", count: activeTab === "past" ? appointments.length : null },
    { key: "cancelled", label: "Cancelled", count: activeTab === "cancelled" ? appointments.length : null },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/patient/dashboard" className="text-gray-400 hover:text-gray-600">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
                <p className="text-gray-500 text-sm">Manage your medical appointments</p>
              </div>
            </div>
            <button
              onClick={() => setShowBooking(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] hover:opacity-90 text-white font-semibold rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
              Book New Appointment
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-8 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-5 py-2.5 rounded-lg text-sm font-medium transition",
                activeTab === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-[var(--primary)]/10 text-[var(--primary)]">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Appointments List */}
        {loading ? (
          <div className="py-4">
            <TableRowsSkeleton rows={5} />
          </div>
        ) : loadError ? (
          <div className="text-center py-20" role="alert">
            <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <p className="text-gray-700 text-lg font-medium">Could not load appointments</p>
            <p className="text-gray-500 text-sm mt-1">{loadError}</p>
            <button
              onClick={fetchAppointments}
              className="mt-4 text-[var(--primary)] hover:opacity-80 font-medium text-sm"
            >
              Try again
            </button>
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No {activeTab} appointments</p>
            <button
              onClick={() => setShowBooking(true)}
              className="mt-4 text-[var(--primary)] hover:text-[var(--primary)] font-medium text-sm"
            >
              Book your first appointment
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((apt) => {
              const statusCfg = STATUS_CONFIG[apt.status] || STATUS_CONFIG.SCHEDULED;
              const StatusIcon = statusCfg.icon;
              return (
                <div
                  key={apt.id}
                  className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Doctor avatar */}
                    <div className="w-14 h-14 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <User className="w-7 h-7 text-[var(--primary)]" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          Dr. {apt.doctor.user.firstName} {apt.doctor.user.lastName}
                        </h3>
                        <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium", statusCfg.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-2">{apt.doctor.specialization}</p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(apt.scheduledAt), "MMM d, yyyy")}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          {format(new Date(apt.scheduledAt), "h:mm a")} ({apt.duration} min)
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          {apt.consultationType === "VIDEO" ? (
                            <Video className="w-4 h-4 text-[var(--primary)]" />
                          ) : (
                            <MapPin className="w-4 h-4 text-emerald-500" />
                          )}
                          {apt.consultationType === "VIDEO" ? "Video Call" : "In Person"}
                        </span>
                      </div>
                      {apt.reason && (
                        <p className="text-sm text-gray-400 mt-2">Reason: {apt.reason}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {apt.status === "CONFIRMED" && apt.consultationType === "VIDEO" && (
                        <Link
                          href={`/patient/telemedicine/${apt.id}`}
                          className="px-4 py-2 bg-[var(--primary)] hover:opacity-90 text-white text-sm font-medium rounded-xl transition"
                        >
                          Join Call
                        </Link>
                      )}
                      {["SCHEDULED", "CONFIRMED"].includes(apt.status) && (
                        <button className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-xl transition">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ─── Booking Modal ─── */}
      {showBooking && (
        <BookingModal
          onClose={() => setShowBooking(false)}
          onSuccess={() => {
            setShowBooking(false);
            fetchAppointments();
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Booking Modal Component
// ═══════════════════════════════════════════════════════════

function BookingModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<BookingStep>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);

  // Step 1 — Doctor selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpeciality, setSelectedSpeciality] = useState("All");
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorOption | null>(null);

  // Step 2 — Consultation type
  const [consultationType, setConsultationType] = useState<"VIDEO" | "IN_PERSON">("VIDEO");

  // Step 3 — Date & time
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  // Step 4 — Reason
  const [reason, setReason] = useState("");

  const loadDoctors = useCallback(async () => {
    setDoctorsLoading(true);
    setDoctorsError(null);

    try {
      const res = await fetch("/api/doctors?limit=50");
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Unable to load doctors");
      }

      if (!Array.isArray(data?.doctors)) {
        throw new Error("The doctors response was invalid");
      }

      setDoctors(data.doctors);
    } catch (error) {
      setDoctors([]);
      setSelectedDoctor(null);
      setDoctorsError(
        error instanceof Error ? error.message : "Unable to load doctors"
      );
    } finally {
      setDoctorsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const filteredDoctors = doctors.filter((d) => {
    const matchesSearch =
      `Dr. ${d.user.firstName} ${d.user.lastName} ${d.specialization}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    const matchesSpec =
      selectedSpeciality === "All" || d.specialization === selectedSpeciality;
    return matchesSearch && matchesSpec;
  });

  // Generate next 14 days for date picker
  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    return date;
  });

  const handleBook = async () => {
    if (!selectedDoctor || !selectedDate || !selectedTime) {
      setSubmitError("Select a doctor, date, and time before booking.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Parse selected time to build the full scheduledAt
      const [time, meridiem] = selectedTime.split(" ");
      const [hourStr, minuteStr] = time.split(":");
      let hour = parseInt(hourStr);
      if (meridiem === "PM" && hour !== 12) hour += 12;
      if (meridiem === "AM" && hour === 12) hour = 0;

      const scheduledAt = new Date(selectedDate);
      scheduledAt.setHours(hour, parseInt(minuteStr), 0, 0);

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          scheduledAt: scheduledAt.toISOString(),
          consultationType,
          reason: reason || undefined,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Unable to book this appointment");
      }

      onSuccess();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to book this appointment"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return !!selectedDoctor;
      case 2: return !!consultationType;
      case 3: return !!selectedDate && !!selectedTime;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Book Appointment</h2>
            <p className="text-sm text-gray-500">Step {step} of 5</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 rounded-full flex-1 transition",
                  s <= step ? "bg-[var(--primary)]" : "bg-gray-200"
                )}
              />
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* ── Step 1: Select Doctor ── */}
          {step === 1 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select a Doctor</h3>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search doctors by name or speciality..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none"
                />
              </div>

              {/* Speciality filter */}
              <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
                {SPECIALITIES.map((spec) => (
                  <button
                    key={spec}
                    onClick={() => setSelectedSpeciality(spec)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition",
                      selectedSpeciality === spec
                        ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                        : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                    )}
                  >
                    {spec}
                  </button>
                ))}
              </div>

              {/* Doctor list */}
              <div className="space-y-3 max-h-[340px] overflow-y-auto">
                {doctorsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                  </div>
                ) : doctorsError ? (
                  <div className="text-center py-8" role="alert">
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-700">{doctorsError}</p>
                    <button
                      onClick={loadDoctors}
                      className="mt-3 text-sm font-medium text-[var(--primary)] hover:opacity-80"
                    >
                      Try again
                    </button>
                  </div>
                ) : (
                  <>
                    {filteredDoctors.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedDoctor(doc)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition text-left",
                          selectedDoctor?.id === doc.id
                            ? "border-[var(--primary)] bg-[var(--primary)]/10"
                            : "border-gray-100 hover:border-gray-300"
                        )}
                      >
                        <div className="w-12 h-12 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-[var(--primary)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900">
                            Dr. {doc.user.firstName} {doc.user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{doc.specialization}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            <span>★ {doc.rating}</span>
                            <span>${doc.consultationFee}/visit</span>
                          </div>
                        </div>
                        {selectedDoctor?.id === doc.id && (
                          <CheckCircle className="w-6 h-6 text-[var(--primary)] flex-shrink-0" />
                        )}
                      </button>
                    ))}
                    {filteredDoctors.length === 0 && (
                      <p className="text-center text-gray-400 py-8">
                        {doctors.length === 0
                          ? "No doctors are currently available"
                          : "No doctors found matching your search"}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Consultation Type ── */}
          {step === 2 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Consultation Type</h3>
              <p className="text-sm text-gray-500 mb-6">How would you like to meet your doctor?</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "VIDEO" as const, label: "Video Call", desc: "Meet online via secure video", icon: Video, color: "blue" },
                  { key: "IN_PERSON" as const, label: "In Person", desc: "Visit the clinic in person", icon: MapPin, color: "emerald" },
                ].map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setConsultationType(option.key)}
                    className={cn(
                      "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition",
                      consultationType === option.key
                        ? `border-${option.color}-600 bg-${option.color}-50`
                        : "border-gray-100 hover:border-gray-300"
                    )}
                  >
                    <div
                      className={cn(
                        "w-14 h-14 rounded-xl flex items-center justify-center",
                        consultationType === option.key
                          ? option.color === "blue" ? "bg-[var(--primary)]/10" : "bg-emerald-100"
                          : "bg-gray-100"
                      )}
                    >
                      <option.icon
                        className={cn(
                          "w-7 h-7",
                          consultationType === option.key
                            ? option.color === "blue" ? "text-[var(--primary)]" : "text-emerald-600"
                            : "text-gray-400"
                        )}
                      />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{option.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{option.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Date & Time ── */}
          {step === 3 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Date & Time</h3>
              <p className="text-sm text-gray-500 mb-6">Pick a convenient date and time slot</p>

              {/* Date selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Date</label>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {dateOptions.map((date) => {
                    const dateStr = date.toISOString().split("T")[0];
                    return (
                      <button
                        key={dateStr}
                        onClick={() => setSelectedDate(dateStr)}
                        className={cn(
                          "flex flex-col items-center min-w-[72px] py-3 px-3 rounded-xl border-2 transition",
                          selectedDate === dateStr
                            ? "border-[var(--primary)] bg-[var(--primary)]/10"
                            : "border-gray-100 hover:border-gray-300"
                        )}
                      >
                        <span className="text-xs text-gray-400">{format(date, "EEE")}</span>
                        <span className="text-lg font-bold text-gray-900">{format(date, "d")}</span>
                        <span className="text-xs text-gray-500">{format(date, "MMM")}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Time</label>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedTime(slot)}
                      className={cn(
                        "py-2.5 rounded-xl text-sm font-medium border transition",
                        selectedTime === slot
                          ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                          : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Reason for Visit ── */}
          {step === 4 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Reason for Visit</h3>
              <p className="text-sm text-gray-500 mb-6">Help the doctor prepare for your visit (optional)</p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition resize-none"
                placeholder="Describe your symptoms or reason for this appointment..."
              />
            </div>
          )}

          {/* ── Step 5: Confirm & Pay ── */}
          {step === 5 && selectedDoctor && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Confirm Appointment</h3>

              <div className="bg-gray-50 rounded-xl p-5 space-y-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center">
                    <Stethoscope className="w-6 h-6 text-[var(--primary)]" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      Dr. {selectedDoctor.user.firstName} {selectedDoctor.user.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{selectedDoctor.specialization}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">
                      {selectedDate ? format(new Date(selectedDate), "MMMM d, yyyy") : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">{selectedTime}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {consultationType === "VIDEO" ? (
                      <Video className="w-4 h-4 text-[var(--primary)]" />
                    ) : (
                      <MapPin className="w-4 h-4 text-emerald-500" />
                    )}
                    <span className="text-gray-700">
                      {consultationType === "VIDEO" ? "Video Call" : "In Person"}
                    </span>
                  </div>
                  {reason && (
                    <div className="col-span-2 flex items-start gap-2 text-sm">
                      <Filter className="w-4 h-4 text-gray-400 mt-0.5" />
                      <span className="text-gray-700">{reason}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Fee summary */}
              <div className="bg-[var(--primary)]/10 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-5 h-5 text-[var(--primary)]" />
                  <span className="font-semibold text-gray-900">Fee Summary</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Consultation fee</span>
                    <span className="text-gray-900">${selectedDoctor.consultationFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Platform fee</span>
                    <span className="text-gray-900">$2.00</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[var(--primary)]/30 font-semibold">
                    <span className="text-gray-900">Total</span>
                    <span className="text-[var(--primary)]">${(selectedDoctor.consultationFee + 2).toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  You can complete payment from the Payments page after booking.
                </p>
              </div>
            </div>
          )}
          {submitError && (
            <div
              className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button
            onClick={() => (step === 1 ? onClose() : setStep((step - 1) as BookingStep))}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:text-gray-900 font-medium rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 5 ? (
            <button
              onClick={() => setStep((step + 1) as BookingStep)}
              disabled={!canProceed()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[var(--primary)] hover:opacity-90 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleBook}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[var(--primary)] hover:opacity-90 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Booking...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Confirm Appointment
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
