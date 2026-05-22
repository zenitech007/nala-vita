import { useQuery } from "@tanstack/react-query";

export function usePatients(search?: string) {
  return useQuery({
    queryKey: ["patients", search],
    queryFn: () =>
      fetch(`/api/patients${search ? `?search=${search}` : ""}`)
        .then((r) => r.json()),
  });
}

export function usePatientEHR(patientId: string) {
  return useQuery({
    queryKey: ["patient-ehr", patientId],
    queryFn: () => fetch(`/api/patients/${patientId}`).then((r) => r.json()),
    enabled: !!patientId,
  });
}
