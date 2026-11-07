import { supabaseAdmin } from "@/lib/supabase-admin";
import { privateChannel } from "@/lib/realtime-events";

export async function publishPrivateEvent(topic: string, event: string, payload: object): Promise<boolean> {
  const channel = supabaseAdmin.channel(topic, privateChannel);
  try {
    const result = await channel.httpSend(event, payload, { timeout: 3000 });
    return result.success;
  } catch {
    return false;
  } finally {
    await supabaseAdmin.removeChannel(channel).catch(() => undefined);
  }
}
