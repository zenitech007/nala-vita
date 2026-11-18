"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchJson } from "@/lib/api-fetch";

const QueryIdentity = createContext<string | null>(null);
export function useQueryUserId() { return useContext(QueryIdentity); }
export function userQueryKey(userId: string | null, ...parts: unknown[]) {
  return ["user", userId ?? "signed-out", ...parts];
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 } },
  }));
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let generation = 0;
    let disposed = false;
    function clearIdentity() {
      generation++;
      void queryClient.cancelQueries();
      queryClient.clear();
      setUserId(null);
    }
    async function resolveIdentity(expectedAuthId?: string) {
      const version = generation;
      try {
        const data = await fetchJson<{ user: { id: string }; authUserId: string }>("/api/auth/session");
        if (!disposed && version === generation && (!expectedAuthId || data.authUserId === expectedAuthId)) {
          setUserId(data.user.id);
        }
      } catch {
        // Unauthenticated or unavailable identity keeps user queries disabled.
      }
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      clearIdentity();
      if (session?.user) void resolveIdentity(session.user.id);
    });
    const restoreIdentity = () => { void resolveIdentity(); };
    window.addEventListener("nala-auth-changing", clearIdentity);
    window.addEventListener("nala-auth-change-failed", restoreIdentity);
    void resolveIdentity();
    return () => {
      disposed = true;
      generation++;
      data.subscription.unsubscribe();
      window.removeEventListener("nala-auth-changing", clearIdentity);
      window.removeEventListener("nala-auth-change-failed", restoreIdentity);
      void queryClient.cancelQueries();
      queryClient.clear();
    };
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}><QueryIdentity.Provider value={userId}>{children}</QueryIdentity.Provider></QueryClientProvider>;
}
