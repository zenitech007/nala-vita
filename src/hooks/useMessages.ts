import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { chatEventSchema, chatTopic, privateChannel } from "@/lib/realtime-events";

export function useMessages(userId: string | null, threadId?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () =>
      fetch(`/api/messages${threadId ? `?otherUserId=${threadId}` : ""}`)
        .then((r) => r.json()),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(chatTopic(userId), privateChannel)
      .on("broadcast", { event: "invalidate" }, ({ payload }) => {
        const event = chatEventSchema.safeParse(payload);
        if (event.success && event.data.receiverId === userId && (!threadId || event.data.senderId === threadId)) {
          void qc.invalidateQueries({ queryKey: ["messages", threadId] });
        }
      }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, threadId, qc]);

  return query;
}
