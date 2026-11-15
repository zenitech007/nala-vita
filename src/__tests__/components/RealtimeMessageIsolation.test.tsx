import {jest} from "@jest/globals";
import {renderHook, waitFor} from "@testing-library/react";
import {useRealtimeMessages} from "@/hooks/useRealtimeMessages";
jest.mock("@/lib/supabase", () => ({supabase:{channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:jest.fn()}}));
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
test("switching chat partners hides messages from the previous thread while loading", async () => {
  global.fetch = jest.fn<typeof fetch>().mockResolvedValueOnce({ok:true,json:async()=>({messages:[{id:"a",senderId:"doctor-a",receiverId:"patient",content:"Private thread A",isRead:true,attachmentUrl:null,createdAt:"2026-11-15T12:00:00Z"}]})} as Response).mockImplementation(()=>new Promise(()=>{}));
  const {result,rerender} = renderHook(({other})=>useRealtimeMessages("patient",other),{initialProps:{other:"doctor-a"}});
  await waitFor(()=>expect(result.current.messages).toHaveLength(1));
  rerender({other:"doctor-b"});
  expect(result.current.messages).toEqual([]);
  expect(result.current.isLoading).toBe(true);
});
