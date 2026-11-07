import { z } from "zod";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const privateChannel = { config: { private: true } } as const;
export const chatTopic = (userId: string) => `nala:chat:${userId}`;
export const callTopic = (appointmentId: string, userId: string) => `nala:call:${appointmentId}:${userId}`;
export const chatEventSchema = z.object({ senderId: id, receiverId: id }).strict();

const sdp = z.string().min(1).max(60_000).startsWith("v=0");
const candidate = z.object({
  candidate: z.string().min(1).max(2000).startsWith("candidate:"),
  sdpMid: z.string().max(128).nullish(),
  sdpMLineIndex: z.number().int().min(0).max(255).nullish(),
  usernameFragment: z.string().max(256).nullish(),
}).strict();
export const signalSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("offer"), data: sdp }).strict(),
  z.object({ type: z.literal("answer"), data: sdp }).strict(),
  z.object({ type: z.literal("ice-candidate"), data: candidate }).strict(),
  z.object({ type: z.literal("ready") }).strict(),
  z.object({ type: z.literal("end-call") }).strict(),
]);
export type Signal = z.infer<typeof signalSchema>;
export const callEventSchema = z.object({
  appointmentId: id, senderId: id, receiverId: id, eventId: z.uuid(),
  issuedAt: z.number().int(), signal: signalSchema,
}).strict();

export function receivedCallSignal(raw: unknown, appointmentId: string, selfId: string, peerId: string, now = Date.now()) {
  const event = callEventSchema.safeParse(raw);
  if (!event.success) return null;
  const value = event.data;
  if (value.appointmentId !== appointmentId || value.senderId !== peerId || value.receiverId !== selfId) return null;
  if (value.issuedAt > now + 5000 || value.issuedAt < now - 60_000) return null;
  return value;
}
