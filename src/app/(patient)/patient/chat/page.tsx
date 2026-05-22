"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare } from "lucide-react";

export default function ChatIndexPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function findThread() {
      try {
        const res = await fetch("/api/messages");
        if (!res.ok) throw new Error("Failed to load messages");
        const data = await res.json();

        if (data.conversations && data.conversations.length > 0) {
          router.replace(`/patient/chat/${data.conversations[0].userId}`);
          return;
        }

        setLoading(false);
      } catch {
        setError("Could not load conversations");
        setLoading(false);
      }
    }
    findThread();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
        <MessageSquare className="w-8 h-8 text-blue-600" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">No Conversations Yet</h2>
      <p className="text-gray-500 text-sm max-w-md">
        {error || "You don't have any messages yet. After booking an appointment, you can message your doctor here."}
      </p>
    </div>
  );
}
