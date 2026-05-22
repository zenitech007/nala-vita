import { useQuery } from "@tanstack/react-query";

export function useDoctors(specialization?: string) {
  return useQuery({
    queryKey: ["doctors", specialization],
    queryFn: () =>
      fetch(`/api/doctors${specialization ? `?specialization=${specialization}` : ""}`)
        .then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
}
