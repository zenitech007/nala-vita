import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function usePatientAppointments(status?: string) {
  return useQuery({
    queryKey: ["appointments", status],
    queryFn: () =>
      fetch(`/api/appointments${status ? `?status=${status}` : ""}`)
        .then((r) => r.json()),
  });
}

export function useBookAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}
