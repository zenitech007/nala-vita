"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ChevronLeft, Loader2 } from "lucide-react";
import ChatWindow from "@/components/chat/ChatWindow";

interface ChatSession {
  currentUserId: string;
  participant: {
    id: string;
    displayName: string;
    roleLabel: string;
  };
}

export default function DoctorChatPage() {
  const params = useParams();
  const patientId = params.id as string;

  const [session, setSession] = useState<ChatSession | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function init() {
      try {
        const res = await fetch(
          `/api/messages/session?otherUserId=${encodeURIComponent(patientId)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Conversation is not available");

        const data = (await res.json()) as ChatSession;
        if (!data.currentUserId || data.participant?.id !== patientId) {
          throw new Error("Conversation response was invalid");
        }
        setSession(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("This conversation could not be loaded.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void init();
    return () => controller.abort();
  }, [patientId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-red-100 bg-white p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
          <h1 className="text-lg font-semibold text-gray-900">
            Conversation unavailable
          </h1>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
          <Link
            href="/doctor/dashboard"
            className="mt-6 inline-flex text-sm font-medium text-[var(--primary)]"
          >
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/doctor/dashboard" className="text-gray-400 hover:text-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {session.participant.displayName}
              </h1>
              <p className="text-gray-500 text-xs">
                {session.participant.roleLabel}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-4">
        <ChatWindow
          currentUserId={session.currentUserId}
          otherUserId={session.participant.id}
          otherUserName={session.participant.displayName}
          otherUserRole={session.participant.roleLabel}
          className="h-[calc(100vh-10rem)]"
        />
      </main>
    </div>
  );
}
