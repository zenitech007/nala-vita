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

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

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
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ── Fetch existing message thread ──────────────────────
  const fetchMessages = useCallback(async () => {
    if (!currentUserId || !otherUserId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/messages?otherUserId=${otherUserId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } catch (err) {
      console.error("[useRealtimeMessages] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, otherUserId]);

  // ── Subscribe to new messages via Supabase Realtime ───
  useEffect(() => {
    if (!currentUserId || !otherUserId) return;

    fetchMessages();

    const channelName = [currentUserId, otherUserId].sort().join(":");

    const channel = supabase
      .channel(`messages:${channelName}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          // Only receive messages relevant to this conversation
          filter: `sender_id=eq.${otherUserId},receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          const newMsg = payload.new as RealtimeMessage;
          setMessages((prev) => [...prev, newMsg]);
          options.onNewMessage?.(newMsg);

          // Auto-mark as read since the user is looking at the thread
          fetch("/api/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageIds: [newMsg.id] }),
          }).catch(() => {});
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [currentUserId, otherUserId, fetchMessages, options]);

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
      setMessages((prev) => [...prev, sent]);
      return sent;
    },
    [currentUserId, otherUserId]
  );

  return { messages, isConnected, isLoading, sendMessage, refetch: fetchMessages };
}
