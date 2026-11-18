import { fetchJson } from "@/lib/api-fetch";
import { useQueryUserId, userQueryKey } from "@/providers";
import { useQuery } from "@tanstack/react-query";

export function usePatients(search?: string) {
  const userId = useQueryUserId();
  return useQuery({
    queryKey: userQueryKey(userId, "patients", search),
    queryFn: ({ signal }) =>
      fetchJson(`/api/patients${search ? `?search=${encodeURIComponent(search)}` : ""}`, { signal }),
    enabled: !!userId,
  });
}

export function usePatientEHR(patientId: string) {
  const userId = useQueryUserId();
  return useQuery({
    queryKey: userQueryKey(userId, "patient-ehr", patientId),
    queryFn: ({ signal }) => fetchJson(`/api/patients/${encodeURIComponent(patientId)}`, { signal }),
    enabled: !!userId && !!patientId,
  });
}
