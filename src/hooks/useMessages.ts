import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

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
    const channel = supabase
      .channel(`messages:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", threadId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, threadId, qc]);

  return query;
}
