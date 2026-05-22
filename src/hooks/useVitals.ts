import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useVitals() {
  return useQuery({
    queryKey: ["vitals"],
    queryFn: () => fetch("/api/vitals").then((r) => r.json()),
  });
}

export function useLogVital() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vitals"] }),
  });
}
