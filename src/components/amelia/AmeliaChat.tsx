"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, Sparkles, ShieldCheck } from "lucide-react";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ReminderCard, { type ReminderSuggestionUI } from "@/components/amelia/ReminderCard";
import AmeliaConversationList, {
  type ConversationSummaryUI,
} from "@/components/amelia/AmeliaConversationList";
import { useStickToBottom } from "@/hooks/useStickToBottom";
import { PATIENT_DISCLAIMER, PRIVACY_NOTICE } from "@/lib/amelia/safety";
import { cn } from "@/lib/utils";

interface UiMessage {
  role: "user" | "assistant";
  content: string;
  sentAt: string;
  reminderSuggestion?: ReminderSuggestionUI;
}

interface Props {
  /** Renders the history sidebar as a collapsible rail beside the transcript. */
  collapsibleHistory?: boolean;
  /**
   * Renders the collapsible rail floating over the transcript — for the chat
   * bubble, which is too narrow to give the expanded rail its own column.
   */
  overlayHistory?: boolean;
}

export default function AmeliaChat({
  collapsibleHistory = false,
  overlayHistory = false,
}: Props = {}) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [emergency, setEmergency] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummaryUI[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Streamed text length drives the scroll follow; messages.length alone wouldn't
  // change while a single reply grows.
  const streamedChars = messages.length > 0 ? messages[messages.length - 1].content.length : 0;
  const { ref: scrollRef, showJump, scrollToBottom } = useStickToBottom<HTMLDivElement>(
    `${messages.length}:${streamedChars}`
  );

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/amelia/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      /* sidebar is non-critical — leave the previous list in place */
    }
  }, []);

  // On mount, resume the most recent conversation and populate the sidebar.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/amelia/conversations?latest=1");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setConversations(data.conversations ?? []);
        if (data.latest) {
          setConversationId(data.latest.id);
          setMessages(
            (data.latest.messages ?? []).map((m: { role: "user" | "assistant"; content: string; sentAt: string }) => ({
              role: m.role,
              content: m.content,
              sentAt: m.sentAt,
            }))
          );
          // Land at the newest message without animating through the history.
          requestAnimationFrame(() => scrollToBottom("auto"));
        }
      } catch {
        /* offline / unauthenticated — start with an empty chat */
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scrollToBottom]);

  const selectConversation = async (id: string) => {
    if (id === conversationId || streaming) return;
    try {
      const res = await fetch(`/api/amelia/conversations/${id}`);
      if (!res.ok) return;
      const { conversation } = await res.json();
      setConversationId(conversation.id);
      setEmergency(false);
      setMessages(
        (conversation.messages ?? []).map((m: { role: "user" | "assistant"; content: string; sentAt: string }) => ({
          role: m.role,
          content: m.content,
          sentAt: m.sentAt,
        }))
      );
      requestAnimationFrame(() => scrollToBottom("auto"));
    } catch {
      /* ignore — the current conversation stays on screen */
    }
  };

  const newConversation = () => {
    if (streaming) return;
    setConversationId(undefined);
    setMessages([]);
    setEmergency(false);
    setInput("");
  };

  const deleteConversation = async (id: string) => {
    setConversations((cs) => cs.filter((c) => c.id !== id));
    if (id === conversationId) newConversation();
    try {
      await fetch(`/api/amelia/conversations/${id}`, { method: "DELETE" });
    } catch {
      /* best-effort; the next refresh reconciles */
    }
    void refreshList();
  };

  /** Replaces the trailing assistant bubble — used to append each delta. */
  const updateLastAssistant = (fn: (prev: UiMessage) => UiMessage) =>
    setMessages((m) => {
      const next = [...m];
      const last = next[next.length - 1];
      if (last?.role === "assistant") next[next.length - 1] = fn(last);
      return next;
    });

  const abortRef = useRef<AbortController | null>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const now = new Date().toISOString();
    setMessages((m) => [...m, { role: "user", content: text, sentAt: now }]);
    setSending(true);
    scrollToBottom();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/amelia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
        signal: controller.signal,
      });

      // Errors (401 / 429 / 500) still come back as JSON, not SSE.
      const contentType = res.headers.get("Content-Type") ?? "";
      if (!res.ok || !contentType.includes("text/event-stream")) {
        const data = await res.json().catch(() => ({}));
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.error ?? "Amelia is unavailable.", sentAt: new Date().toISOString() },
        ]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      let opened = false;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line; keep any partial tail.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;

          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }

          if (evt.type === "meta") {
            setConversationId(evt.conversationId as string);
          } else if (evt.type === "start") {
            setEmergency(evt.urgency === "emergency");
            setStreaming(true);
            setSending(false);
            opened = true;
            setMessages((m) => [
              ...m,
              { role: "assistant", content: "", sentAt: new Date().toISOString() },
            ]);
          } else if (evt.type === "delta") {
            updateLastAssistant((prev) => ({ ...prev, content: prev.content + (evt.text as string) }));
          } else if (evt.type === "done") {
            if (evt.reminderSuggestion) {
              updateLastAssistant((prev) => ({
                ...prev,
                reminderSuggestion: evt.reminderSuggestion as ReminderSuggestionUI,
              }));
            }
            void refreshList();
          } else if (evt.type === "error") {
            const msg = (evt.error as string) ?? "Amelia was interrupted.";
            if (opened) {
              updateLastAssistant((prev) => ({
                ...prev,
                content: prev.content ? `${prev.content}\n\n_${msg}_` : msg,
              }));
            } else {
              setMessages((m) => [...m, { role: "assistant", content: msg, sentAt: new Date().toISOString() }]);
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "Amelia is unavailable right now.", sentAt: new Date().toISOString() },
        ]);
      }
    } finally {
      setSending(false);
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="relative flex h-full bg-white">
      <AmeliaConversationList
        conversations={conversations}
        activeId={conversationId}
        loading={loadingList}
        onSelect={selectConversation}
        onNew={newConversation}
        onDelete={deleteConversation}
        collapsible={collapsibleHistory}
        overlay={overlayHistory}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {emergency && (
          <div className="bg-red-600 text-white text-sm font-semibold px-4 py-2">
            ⚠️ Possible emergency — please seek care now.
          </div>
        )}

        <div className="relative flex-1 min-h-0">
          {/* In overlay mode the retracted rail leaves a floating open button at
              the top-left; reserve a gutter so it never sits on a message. The
              padding is constant so toggling the rail doesn't reflow the text. */}
          <div
            ref={scrollRef}
            className={cn(
              "absolute inset-0 overflow-y-auto py-3 space-y-1",
              overlayHistory ? "pl-12 pr-4" : "px-4"
            )}
          >
            {messages.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-10 px-4 max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 bg-[var(--primary)]/10 text-[var(--primary)] rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    Hi, I&apos;m Amelia. Tell me how you&apos;re feeling or ask a health question.
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Your personal AI medical companion. Ask questions about your lab results, medications, symptoms, or care plans.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-semibold rounded-full border border-emerald-200/60" title={PRIVACY_NOTICE}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Strict Data Isolation &middot; HIPAA Protected</span>
                </div>
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

          {showJump && (
            <button
              type="button"
              onClick={() => scrollToBottom()}
              aria-label="Scroll to latest message"
              className="absolute bottom-3 left-1/2 -translate-x-1/2 p-2 rounded-full bg-white shadow-md border border-gray-200 text-gray-500 hover:text-gray-700 transition"
            >
              <ArrowDown size={16} />
            </button>
          )}
        </div>

        <p className="text-[10px] leading-snug text-gray-400 px-4 py-1.5 border-t border-gray-100" title={PRIVACY_NOTICE}>
          {PATIENT_DISCLAIMER}
        </p>
        <div className="p-2 border-t border-gray-100">
          <ChatInput value={input} onChange={setInput} onSend={send} isSending={sending || streaming} />
        </div>
      </div>
    </div>
  );
}
