"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Calendar,
  Clock,
  Stethoscope,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import VideoCallPanel from "@/components/telemedicine/VideoCallPanel";

interface AppointmentInfo {
  id: string;
  scheduledAt: string;
  duration: number;
  status: string;
  consultationType: string;
  doctor: {
    specialization: string;
    user: { firstName: string; lastName: string; avatarUrl: string | null };
  };
}

export default function PatientTelemedicinePage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = params.appointmentId as string;

  const [userId, setUserId] = useState<string>("");
  const [appointment, setAppointment] = useState<AppointmentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [callEnded, setCallEnded] = useState(false);

  useEffect(() => {
    async function init() {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      // Fetch appointment details
      try {
        const res = await fetch(`/api/appointments/${appointmentId}`);
        if (res.ok) {
          const data = await res.json();
          setAppointment(data.appointment);
        }
      } catch {
        // placeholder will show
      }
      setLoading(false);
    }
    init();
  }, [appointmentId]);

  // Placeholder appointment if API not wired
  const displayAppointment: AppointmentInfo = appointment || {
    id: appointmentId,
    scheduledAt: new Date().toISOString(),
    duration: 30,
    status: "IN_PROGRESS",
    consultationType: "VIDEO",
    doctor: {
      specialization: "General Practice",
      user: { firstName: "Sarah", lastName: "Johnson", avatarUrl: null },
    },
  };

  const handleCallEnd = () => {
    setCallEnded(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

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
          <p className="text-gray-500 mb-2">
            Your video consultation with Dr.{" "}
            {displayAppointment.doctor.user.firstName}{" "}
            {displayAppointment.doctor.user.lastName} has ended.
          </p>
          <p className="text-sm text-gray-400 mb-8">
            Any prescriptions or notes will appear in your dashboard shortly.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/patient/dashboard"
              className="w-full py-3 bg-[var(--primary)] hover:opacity-90 text-white font-semibold rounded-xl transition text-center"
            >
              Return to Dashboard
            </Link>
            <Link
              href="/patient/prescriptions"
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition text-center"
            >
              View Prescriptions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-white font-semibold">
                Consultation with Dr.{" "}
                {displayAppointment.doctor.user.firstName}{" "}
                {displayAppointment.doctor.user.lastName}
              </h1>
              <p className="text-gray-400 text-sm">
                {displayAppointment.doctor.specialization}
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

      {/* Main: Video panel */}
      <main className="flex-1 p-4 max-w-5xl mx-auto w-full">
        {displayAppointment.consultationType !== "VIDEO" ? (
          <div className="flex items-center justify-center h-full">
            <div className="bg-gray-800 rounded-2xl p-10 text-center">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <p className="text-white text-lg font-medium">
                This is not a video consultation
              </p>
              <p className="text-gray-400 text-sm mt-2">
                This appointment is scheduled as{" "}
                {displayAppointment.consultationType.replace("_", " ").toLowerCase()}
              </p>
            </div>
          </div>
        ) : (
          <VideoCallPanel
            appointmentId={appointmentId}
            userId={userId}
            isInitiator={false}
            onCallEnd={handleCallEnd}
            className="h-[calc(100vh-10rem)]"
          />
        )}
      </main>
    </div>
  );
}
