import { fetchJson } from "@/lib/api-fetch";
import { useQueryUserId, userQueryKey } from "@/providers";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useNotifications(userId: string | null) {
  const qc = useQueryClient();
  const verifiedUserId = useQueryUserId();
  const activeUserId = userId === verifiedUserId ? userId : null;

  const query = useQuery({
    queryKey: userQueryKey(activeUserId, "notifications"),
    queryFn: ({ signal }) => fetchJson("/api/notifications", { signal }),
    enabled: !!activeUserId,
  });

  useEffect(() => {
    if (!activeUserId) return;
    const channel = supabase
      .channel(`notifications:${activeUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${activeUserId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: userQueryKey(activeUserId, "notifications") });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeUserId, qc]);

  return query;
}
