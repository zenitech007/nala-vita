import { fetchJson, ApiError } from "@/lib/api-fetch";
import { useQueryUserId, userQueryKey } from "@/providers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function usePatientAppointments(status?: string) {
  const userId = useQueryUserId();
  return useQuery({
    queryKey: userQueryKey(userId, "appointments", status),
    queryFn: ({ signal }) =>
      fetchJson(`/api/appointments${status ? `?status=${encodeURIComponent(status)}` : ""}`, { signal }),
    enabled: !!userId,
  });
}

export function useBookAppointment() {
  const userId = useQueryUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (!userId) throw new ApiError(401, "Sign in before saving.");
      return fetchJson("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: userQueryKey(userId, "appointments") }),
  });
}
