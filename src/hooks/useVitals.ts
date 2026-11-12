import { fetchJson, ApiError } from "@/lib/api-fetch";
import { useQueryUserId, userQueryKey } from "@/providers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useVitals() {
  const userId = useQueryUserId();
  return useQuery({
    queryKey: userQueryKey(userId, "vitals"),
    queryFn: ({ signal }) => fetchJson("/api/vitals", { signal }),
    enabled: !!userId,
  });
}

export function useLogVital() {
  const userId = useQueryUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (!userId) throw new ApiError(401, "Sign in before saving.");
      return fetchJson("/api/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: userQueryKey(userId, "vitals") }),
  });
}
