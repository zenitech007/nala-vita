"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ChatWindow from "@/components/chat/ChatWindow";

export default function PatientChatPage() {
  const params = useParams();
  const doctorId = params.id as string;

  const [currentUserId, setCurrentUserId] = useState("");
  const [doctorName, setDoctorName] = useState("Doctor");
  const [doctorSpeciality, setDoctorSpeciality] = useState("Physician");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      // In production, fetch doctor details from API
      // For now, use placeholder
      setDoctorName("Dr. Sarah Johnson");
      setDoctorSpeciality("General Practice");
      setLoading(false);
    }
    init();
  }, [doctorId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/patient/dashboard" className="text-gray-400 hover:text-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{doctorName}</h1>
              <p className="text-gray-500 text-xs">{doctorSpeciality}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-4">
        <ChatWindow
          currentUserId={currentUserId}
          otherUserId={doctorId}
          otherUserName={doctorName}
          otherUserRole={doctorSpeciality}
          className="h-[calc(100vh-10rem)]"
        />
      </main>
    </div>
  );
}
