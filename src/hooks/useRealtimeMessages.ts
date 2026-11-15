/**
 * useRealtimeMessages
 *
 * Subscribes to the `messages` table via Supabase Realtime so that new
 * messages appear instantly without polling.
 *
 * Replaces the missing Socket.IO server. Supabase Realtime is already
 * available in the stack — no extra infrastructure required.
 *
 * Usage:
 *   const { messages, isConnected } = useRealtimeMessages(currentUserId, otherUserId);
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { chatEventSchema, chatTopic, privateChannel } from "@/lib/realtime-events";

export interface RealtimeMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  attachmentUrl: string | null;
  createdAt: string;
}

interface UseRealtimeMessagesOptions {
  onNewMessage?: (msg: RealtimeMessage) => void;
}

export function useRealtimeMessages(
  currentUserId: string | null,
  otherUserId: string | null,
  options: UseRealtimeMessagesOptions = {}
) {
  const threadKey = `${currentUserId}:${otherUserId}`;
  const [thread, setThread] = useState<{ key: string; messages: RealtimeMessage[] } | null>(null);
  const messages = thread?.key === threadKey ? thread.messages : [];
  const isLoading = !!currentUserId && !!otherUserId && thread?.key !== threadKey;
  const { onNewMessage } = options;
  const [isConnected, setIsConnected] = useState(false);

  const seenMessages = useRef(new Set<string>());

  // ── Fetch existing message thread ──────────────────────
  const fetchMessages = useCallback((liveUpdate = false, signal?: AbortSignal) => {
    if (!currentUserId || !otherUserId) return;
    return fetch(`/api/messages?otherUserId=${encodeURIComponent(otherUserId)}`, { signal }).then(async res => {
      if (res.ok) {
        const data = await res.json();
        if (signal?.aborted) return;
        const rows: RealtimeMessage[] = Array.isArray(data.messages) ? data.messages : [];
        if (liveUpdate) {
          const unread = rows.filter(row => row.senderId === otherUserId && row.receiverId === currentUserId && !seenMessages.current.has(row.id));
          for (const row of unread) onNewMessage?.(row);
          if (unread.length) void fetch("/api/messages", { method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageIds: unread.map(row => row.id) }) }).catch(() => undefined);
        }
        seenMessages.current = new Set(rows.map(row => row.id));
        setThread({ key: threadKey, messages: rows });
      }
    }).catch((err: unknown) => {
      console.error("[useRealtimeMessages] fetch error:", err);
    }).finally(() => {
      if (!signal?.aborted) setThread(current => current?.key === threadKey ? current : { key: threadKey, messages: [] });
    });
  }, [currentUserId, otherUserId, onNewMessage, threadKey]);

  // ── Subscribe to new messages via Supabase Realtime ───
  useEffect(() => {
    if (!currentUserId || !otherUserId) return;

    const controller = new AbortController();
    void fetchMessages(false, controller.signal);

    const channel = supabase.channel(chatTopic(currentUserId), privateChannel)
      .on("broadcast", { event: "invalidate" }, ({ payload }) => {
        const event = chatEventSchema.safeParse(payload);
        if (event.success && event.data.senderId === otherUserId && event.data.receiverId === currentUserId) {
          void fetchMessages(true, controller.signal);
        }
      }).subscribe(status => setIsConnected(status === "SUBSCRIBED"));
    return () => {
      controller.abort();
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [currentUserId, otherUserId, fetchMessages]);

  // ── Send a message ─────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string, attachmentUrl?: string) => {
      if (!currentUserId || !otherUserId || !content.trim()) return null;

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: otherUserId,
          content: content.trim(),
          attachmentUrl: attachmentUrl ?? null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to send message");
      }

      const data = await res.json();
      const sent = data.message as RealtimeMessage;

      // Optimistic update — our own sent messages won't come back via the
      // Realtime subscription (which filters for messages FROM the other user)
      setThread(current => ({ key: threadKey, messages: [...(current?.key === threadKey ? current.messages : []), sent] }));
      return sent;
    },
    [currentUserId, otherUserId, threadKey]
  );

  return { messages, isConnected, isLoading, sendMessage, refetch: fetchMessages };
}
