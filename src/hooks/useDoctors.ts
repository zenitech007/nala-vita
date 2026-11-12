import { fetchJson } from "@/lib/api-fetch";
import { useQueryUserId, userQueryKey } from "@/providers";
import { useQuery } from "@tanstack/react-query";

export function useDoctors(specialization?: string) {
  const userId = useQueryUserId();
  return useQuery({
    queryKey: userQueryKey(userId, "doctors", specialization),
    queryFn: ({ signal }) =>
      fetchJson(`/api/doctors${specialization ? `?specialization=${encodeURIComponent(specialization)}` : ""}`, { signal }),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
