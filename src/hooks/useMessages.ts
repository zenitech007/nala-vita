import { fetchJson } from "@/lib/api-fetch";
import { useQueryUserId, userQueryKey } from "@/providers";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { chatEventSchema, chatTopic, privateChannel } from "@/lib/realtime-events";

export function useMessages(userId: string | null, threadId?: string) {
  const qc = useQueryClient();
  const verifiedUserId = useQueryUserId();
  const activeUserId = userId === verifiedUserId ? userId : null;

  const query = useQuery({
    queryKey: userQueryKey(activeUserId, "messages", threadId),
    queryFn: ({ signal }) =>
      fetchJson(`/api/messages${threadId ? `?otherUserId=${encodeURIComponent(threadId)}` : ""}`, { signal }),
    enabled: !!activeUserId,
  });

  useEffect(() => {
    if (!activeUserId) return;
    const channel = supabase.channel(chatTopic(activeUserId), privateChannel)
      .on("broadcast", { event: "invalidate" }, ({ payload }) => {
        const event = chatEventSchema.safeParse(payload);
        if (event.success && event.data.receiverId === activeUserId && (!threadId || event.data.senderId === threadId)) {
          void qc.invalidateQueries({ queryKey: userQueryKey(activeUserId, "messages", threadId) });
        }
      }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeUserId, threadId, qc]);

  return query;
}
