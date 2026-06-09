"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ReminderCard, { type ReminderSuggestionUI } from "@/components/amelia/ReminderCard";
import { PATIENT_DISCLAIMER } from "@/lib/amelia/safety";

interface UiMessage {
  role: "user" | "assistant";
  content: string;
  sentAt: string;
  reminderSuggestion?: ReminderSuggestionUI;
}

export default function AmeliaChat() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [emergency, setEmergency] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text, sentAt: new Date().toISOString() }]);
    setSending(true);
    try {
      const res = await fetch("/api/amelia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setConversationId(data.conversationId);
        setEmergency(data.reply.urgency === "emergency");
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.reply.content, sentAt: new Date().toISOString(), reminderSuggestion: data.reminderSuggestion ?? undefined },
        ]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.error ?? "Amelia is unavailable.", sentAt: new Date().toISOString() }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Amelia is unavailable right now.", sentAt: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {emergency && (
        <div className="bg-red-600 text-white text-sm font-semibold px-4 py-2">
          ⚠️ Possible emergency — please seek care now.
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            <Sparkles className="w-6 h-6 mx-auto mb-2 text-[var(--primary)]" />
            Hi, I&apos;m Amelia. Tell me how you&apos;re feeling or ask a health question.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            <ChatMessage isMine={m.role === "user"} content={m.content} sentAt={m.sentAt} otherInitials="A" />
            {m.reminderSuggestion && <ReminderCard suggestion={m.reminderSuggestion} />}
          </div>
        ))}
        {sending && <TypingIndicator />}
      </div>
      <p className="text-[10px] leading-snug text-gray-400 px-4 py-1 border-t border-gray-100">{PATIENT_DISCLAIMER}</p>
      <div className="p-2 border-t border-gray-100">
        <ChatInput value={input} onChange={setInput} onSend={send} isSending={sending} />
      </div>
    </div>
  );
}
