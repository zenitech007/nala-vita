import { useEffect } from "react";
import { render, waitFor, act } from "@testing-library/react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import Providers from "@/providers";

let authChanged: (event: string, session: unknown) => void;
const subscribe = jest.fn(callback => {
  authChanged = callback;
  return { data: { subscription: { unsubscribe: jest.fn() } } };
});
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { onAuthStateChange: (callback: typeof authChanged) => subscribe(callback) } } }));
let client: QueryClient;
function CaptureClient() {
  const queryClient = useQueryClient();
  useEffect(() => { client = queryClient; }, [queryClient]);
  return null;
}

test("clears cached patient data when authentication changes", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: { id: "u1" }, authUserId: "auth1" }) });
  render(<Providers><CaptureClient /></Providers>);
  await waitFor(() => expect(subscribe).toHaveBeenCalled());
  client.setQueryData(["user", "u1", "vitals"], { synthetic: true });
  act(() => authChanged("SIGNED_OUT", null));
  expect(client.getQueryData(["user", "u1", "vitals"])).toBeUndefined();
});
