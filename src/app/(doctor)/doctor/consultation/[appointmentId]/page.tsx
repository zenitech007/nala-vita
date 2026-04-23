"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Calendar,
  Clock,
  User,
  Stethoscope,
  Activity,
  Pill,
  AlertTriangle,
  FileText,
  Save,
  Mic,
  MicOff,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import VideoCallPanel from "@/components/telemedicine/VideoCallPanel";

// ─── Types ───────────────────────────────────────────────

interface PatientEHR {
  id: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string | null;
  allergies: string[];
  user: {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    email: string;
    phone: string | null;
  };
  vitals: {
    id: string;
    bloodPressure: string | null;
    heartRate: number | null;
    temperature: number | null;
    oxygenSaturation: number | null;
    recordedAt: string;
  }[];
  prescriptions: {
    id: string;
    medication: string;
    dosage: string;
    frequency: string;
    isActive: boolean;
  }[];
  medicalNotes: {
    id: string;
    title: string;
    content: string;
    createdAt: string;
  }[];
}

interface AppointmentDetail {
  id: string;
  scheduledAt: string;
  duration: number;
  status: string;
  consultationType: string;
  reason: string | null;
  patient: PatientEHR;
}

// ─── SpeechRecognition type augmentation ─────────────────

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export default function DoctorConsultationPage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = params.appointmentId as string;

  const [userId, setUserId] = useState("");
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [callEnded, setCallEnded] = useState(false);

  // Notes state
  const [notes, setNotes] = useState("");
  const [noteTitle, setNoteTitle] = useState("Consultation Notes");
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Voice-to-text
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // ─── Init ──────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      try {
        const res = await fetch(`/api/appointments/${appointmentId}`);
        if (res.ok) {
          const data = await res.json();
          setAppointment(data.appointment);
        }
      } catch {
        // placeholder data shown
      }
      setLoading(false);
    }
    init();
  }, [appointmentId]);

  // Placeholder
  const patient: PatientEHR = appointment?.patient || {
    id: "patient-1",
    dateOfBirth: "1985-03-15",
    gender: "Female",
    bloodType: "A+",
    allergies: ["Penicillin", "Sulfa drugs"],
    user: {
      firstName: "Alice",
      lastName: "Brown",
      avatarUrl: null,
      email: "alice@email.com",
      phone: "+1 555-000-001",
    },
    vitals: [
      { id: "v1", bloodPressure: "145/95", heartRate: 88, temperature: 98.8, oxygenSaturation: 97, recordedAt: new Date().toISOString() },
      { id: "v2", bloodPressure: "138/90", heartRate: 82, temperature: 98.6, oxygenSaturation: 98, recordedAt: new Date(Date.now() - 86400000 * 3).toISOString() },
    ],
    prescriptions: [
      { id: "rx1", medication: "Lisinopril 10mg", dosage: "10mg", frequency: "Once daily", isActive: true },
      { id: "rx2", medication: "Metformin 500mg", dosage: "500mg", frequency: "Twice daily", isActive: true },
    ],
    medicalNotes: [
      { id: "n1", title: "Previous checkup", content: "Patient reports occasional dizziness. BP slightly elevated. Continue current medications.", createdAt: new Date(Date.now() - 86400000 * 30).toISOString() },
    ],
  };

  const displayAppointment: AppointmentDetail = appointment || {
    id: appointmentId,
    scheduledAt: new Date().toISOString(),
    duration: 30,
    status: "IN_PROGRESS",
    consultationType: "VIDEO",
    reason: "Follow-up on blood pressure",
    patient,
  };

  const calculateAge = (dob: string) => {
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (
      now.getMonth() < birth.getMonth() ||
      (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
    )
      age--;
    return age;
  };

  // ─── Voice-to-text ────────────────────────────────────

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setNotes((prev) => {
        // If the last result was final, append with a space
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          return prev + (prev ? " " : "") + transcript.trim();
        }
        return prev;
      });
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  // ─── Save notes to EHR ────────────────────────────────

  const saveNotes = async () => {
    if (!notes.trim()) return;
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch(
        `/api/patients/${patient.id}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: noteTitle,
            content: notes,
            category: "Consultation",
          }),
        }
      );

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch {
      // handle error
    } finally {
      setIsSaving(false);
    }
  };

  const handleCallEnd = () => {
    setCallEnded(true);
  };

  // ─── Loading ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  // ─── Post-call ─────────────────────────────────────────

  if (callEnded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Stethoscope className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Consultation Complete
          </h2>
          <p className="text-gray-500 mb-8">
            Don&apos;t forget to save your notes and write prescriptions if needed.
          </p>

          {/* Quick save notes before leaving */}
          {notes.trim() && !savedSuccess && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
              <p className="text-sm text-amber-800 font-medium mb-2">
                You have unsaved notes
              </p>
              <button
                onClick={saveNotes}
                disabled={isSaving}
                className="text-sm text-amber-700 underline hover:text-amber-900"
              >
                {isSaving ? "Saving..." : "Save notes now"}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Link
              href="/doctor/prescriptions"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition text-center"
            >
              Write Prescription
            </Link>
            <Link
              href="/doctor/dashboard"
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition text-center"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main consultation view ────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-white font-semibold">
                Consultation: {patient.user.firstName}{" "}
                {patient.user.lastName}
              </h1>
              <p className="text-gray-400 text-sm">
                {displayAppointment.reason || "Video Consultation"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {format(new Date(displayAppointment.scheduledAt), "MMM d, yyyy")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {displayAppointment.duration} min
            </span>
          </div>
        </div>
      </header>

      {/* Main: Video + EHR Panel */}
      <main className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left: Video + Notes */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Video */}
          <VideoCallPanel
            appointmentId={appointmentId}
            userId={userId}
            isInitiator={true}
            onCallEnd={handleCallEnd}
            className="flex-1 min-h-[300px]"
          />

          {/* Notes with voice-to-text */}
          <div className="bg-gray-800 rounded-2xl p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="bg-transparent text-white text-sm font-medium focus:outline-none border-b border-transparent focus:border-gray-600 transition"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleRecording}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition",
                    isRecording
                      ? "bg-red-500/20 text-red-400 border border-red-500/50"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  )}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="w-3.5 h-3.5" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      Voice to Text
                    </>
                  )}
                </button>
                <button
                  onClick={saveNotes}
                  disabled={isSaving || !notes.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : savedSuccess ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  {savedSuccess ? "Saved!" : "Save to EHR"}
                </button>
              </div>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full bg-gray-900 text-gray-200 text-sm rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none placeholder-gray-600"
              placeholder="Type or dictate your consultation notes here..."
            />
            {isRecording && (
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-400">
                  Listening... speak clearly into your microphone
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Patient EHR Panel */}
        <div className="w-80 bg-gray-800 rounded-2xl flex-shrink-0 overflow-y-auto">
          {/* Patient Header */}
          <div className="px-5 py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-blue-600/20 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">
                  {patient.user.firstName} {patient.user.lastName}
                </p>
                <p className="text-gray-400 text-xs">
                  {calculateAge(patient.dateOfBirth)} yrs &middot;{" "}
                  {patient.gender}
                  {patient.bloodType && ` &middot; ${patient.bloodType}`}
                </p>
              </div>
            </div>
          </div>

          {/* Allergies */}
          {patient.allergies.length > 0 && (
            <div className="px-5 py-3 border-b border-gray-700">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                Allergies
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {patient.allergies.map((a) => (
                  <span
                    key={a}
                    className="px-2 py-0.5 bg-red-500/20 text-red-300 text-xs rounded-lg font-medium"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Vitals */}
          <div className="px-5 py-3 border-b border-gray-700">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              Recent Vitals
            </h4>
            {patient.vitals.length === 0 ? (
              <p className="text-xs text-gray-500">No vitals recorded</p>
            ) : (
              <div className="space-y-2">
                {patient.vitals.slice(0, 3).map((v) => (
                  <div
                    key={v.id}
                    className="bg-gray-900 rounded-lg p-2.5"
                  >
                    <p className="text-xs text-gray-500 mb-1">
                      {format(new Date(v.recordedAt), "MMM d, yyyy")}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {v.bloodPressure && (
                        <div>
                          <span className="text-gray-500">BP: </span>
                          <span className="text-gray-200 font-medium">
                            {v.bloodPressure}
                          </span>
                        </div>
                      )}
                      {v.heartRate && (
                        <div>
                          <span className="text-gray-500">HR: </span>
                          <span className="text-gray-200 font-medium">
                            {v.heartRate} bpm
                          </span>
                        </div>
                      )}
                      {v.temperature && (
                        <div>
                          <span className="text-gray-500">Temp: </span>
                          <span className="text-gray-200 font-medium">
                            {v.temperature}°F
                          </span>
                        </div>
                      )}
                      {v.oxygenSaturation && (
                        <div>
                          <span className="text-gray-500">SpO2: </span>
                          <span className="text-gray-200 font-medium">
                            {v.oxygenSaturation}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Medications */}
          <div className="px-5 py-3 border-b border-gray-700">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Pill className="w-3.5 h-3.5" />
              Active Medications
            </h4>
            {patient.prescriptions.filter((p) => p.isActive).length === 0 ? (
              <p className="text-xs text-gray-500">No active medications</p>
            ) : (
              <div className="space-y-1.5">
                {patient.prescriptions
                  .filter((p) => p.isActive)
                  .map((rx) => (
                    <div
                      key={rx.id}
                      className="bg-gray-900 rounded-lg px-2.5 py-2"
                    >
                      <p className="text-xs text-gray-200 font-medium">
                        {rx.medication}
                      </p>
                      <p className="text-xs text-gray-500">
                        {rx.dosage} &middot; {rx.frequency}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Medical History / Notes */}
          <div className="px-5 py-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              Medical History
            </h4>
            {patient.medicalNotes.length === 0 ? (
              <p className="text-xs text-gray-500">No previous notes</p>
            ) : (
              <div className="space-y-2">
                {patient.medicalNotes.slice(0, 5).map((note) => (
                  <div
                    key={note.id}
                    className="bg-gray-900 rounded-lg p-2.5"
                  >
                    <p className="text-xs text-gray-200 font-medium">
                      {note.title}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                      {note.content}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {format(new Date(note.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
