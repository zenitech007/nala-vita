import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: () => ({ auth: { getUser: () => getUser() } }) }));

const userFindUnique = jest.fn();
const convoFindFirst = jest.fn();
const convoCreate = jest.fn();
const convoUpdate = jest.fn();
const msgCreate = jest.fn();
const msgFindMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    ameliaConversation: {
      findFirst: (...a: unknown[]) => convoFindFirst(...a),
      create: (...a: unknown[]) => convoCreate(...a),
      update: (...a: unknown[]) => convoUpdate(...a),
    },
    ameliaMessage: { create: (...a: unknown[]) => msgCreate(...a), findMany: (...a: unknown[]) => msgFindMany(...a) },
  },
}));

jest.mock("@/lib/rate-limit", () => ({ checkRateLimitAsync: async () => ({ allowed: true, remaining: 19, resetAt: Date.now() + 60000 }) }));
const runAmeliaTurn = jest.fn();
const runAmeliaTurnStream = jest.fn();
jest.mock("@/lib/amelia/engine", () => ({
  runAmeliaTurn: (...a: unknown[]) => runAmeliaTurn(...a),
  runAmeliaTurnStream: (...a: unknown[]) => runAmeliaTurnStream(...a),
}));
const extractMemories = jest.fn();
const saveMemories = jest.fn();
jest.mock("@/lib/amelia/memory", () => ({
  extractMemories: (...a: unknown[]) => extractMemories(...a),
  saveMemories: (...a: unknown[]) => saveMemories(...a),
}));
const detectReminder = jest.fn();
jest.mock("@/lib/amelia/reminders", () => ({
  detectReminder: (...a: unknown[]) => detectReminder(...a),
  computeNextFireAt: () => new Date(2026, 5, 12, 8, 0),
  describeSchedule: () => "every day at 8:00 AM",
}));
jest.mock("@/lib/amelia/audit", () => ({ logAmeliaAudit: async () => undefined }));

import { POST } from "@/app/api/amelia/chat/route";

/** Buffered request — the streaming path is the route default, so opt out here. */
function req(body: Record<string, unknown>) {
  return new Request("http://localhost/api/amelia/chat", {
    method: "POST",
    body: JSON.stringify({ stream: false, ...body }),
  }) as never;
}

function streamReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/amelia/chat", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;
}

/** Collects an SSE body into the list of parsed `data:` frames. */
async function readFrames(res: Response): Promise<Record<string, unknown>[]> {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => JSON.parse(chunk.slice("data: ".length)) as Record<string, unknown>);
}

beforeEach(() => {
  [getUser, userFindUnique, convoFindFirst, convoCreate, convoUpdate, msgCreate, msgFindMany, runAmeliaTurn, runAmeliaTurnStream, extractMemories, saveMemories, detectReminder].forEach((m) => m.mockReset());
  extractMemories.mockResolvedValue([{ kind: "PREFERENCE", value: "mornings" }]);
  saveMemories.mockResolvedValue(undefined);
  detectReminder.mockResolvedValue(null);
  convoUpdate.mockResolvedValue({ id: "c1" });
});

describe("POST /api/amelia/chat", () => {
  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ message: "hi" }));
    expect(res.status).toBe(401);
  });

  it("returns Amelia's reply on the happy path", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub-1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    convoCreate.mockResolvedValue({ id: "c1" });
    msgCreate.mockResolvedValue({ id: "um1" });
    msgFindMany.mockResolvedValue([{ role: "user", content: "I have a sore throat" }]);
    runAmeliaTurn.mockResolvedValue({ content: "Advice. Confirm with a doctor.", urgency: "routine", redFlags: [], disclaimer: "d" });

    const res = await POST(req({ message: "I have a sore throat" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.conversationId).toBe("c1");
    expect(json.reply.content).toMatch(/Advice/);
    expect(extractMemories).toHaveBeenCalledTimes(1);
    expect(saveMemories).toHaveBeenCalledTimes(1);
  });

  it("includes a reminderSuggestion when a reminder is detected", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub-1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    convoCreate.mockResolvedValue({ id: "c1" });
    msgCreate.mockResolvedValue({ id: "um1" });
    msgFindMany.mockResolvedValue([{ role: "user", content: "remind me to take meds at 8" }]);
    runAmeliaTurn.mockResolvedValue({ content: "Sure!", urgency: "routine", redFlags: [], disclaimer: "d" });
    detectReminder.mockResolvedValue({ kind: "MEDICATION", label: "take meds", frequency: "DAILY", hour: 8, minute: 0 });

    const res = await POST(req({ message: "remind me to take meds at 8" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.reminderSuggestion).toBeTruthy();
    expect(json.reminderSuggestion.label).toBe("take meds");
    expect(json.reminderSuggestion.schedule).toBe("every day at 8:00 AM");
  });
});

describe("POST /api/amelia/chat (streaming)", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "sub-1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    convoCreate.mockResolvedValue({ id: "c1" });
    msgCreate.mockResolvedValue({ id: "um1" });
    msgFindMany.mockResolvedValue([{ role: "user", content: "I feel dizzy" }]);
    runAmeliaTurnStream.mockImplementation(async function* () {
      yield { type: "start", meta: { urgency: "routine", redFlags: [], disclaimer: "d" } };
      yield { type: "delta", text: "Drink " };
      yield { type: "delta", text: "water." };
    });
  });

  it("streams deltas as SSE and closes with a done frame", async () => {
    const res = await POST(streamReq({ message: "I feel dizzy" }));

    expect(res.headers.get("Content-Type")).toMatch(/text\/event-stream/);

    const frames = await readFrames(res as Response);
    const types = frames.map((f) => f.type);
    expect(types).toEqual(["meta", "start", "delta", "delta", "done"]);
    expect(frames.filter((f) => f.type === "delta").map((f) => f.text).join("")).toBe("Drink water.");
    expect(frames[frames.length - 1].conversationId).toBe("c1");
  });

  it("persists the accumulated reply and bumps the conversation timestamp", async () => {
    await readFrames((await POST(streamReq({ message: "I feel dizzy" }))) as Response);

    // Two message writes: the user's, then the assembled assistant reply.
    expect(msgCreate).toHaveBeenCalledTimes(2);
    expect(msgCreate.mock.calls[1]).toEqual([
      { data: { conversationId: "c1", role: "assistant", content: "Drink water." } },
    ]);
    expect(convoUpdate).toHaveBeenCalledTimes(1);
  });

  it("runs memory extraction after the stream completes", async () => {
    await readFrames((await POST(streamReq({ message: "I feel dizzy" }))) as Response);

    expect(extractMemories).toHaveBeenCalledTimes(1);
    // Extraction sees the fully assembled reply, not a partial delta.
    expect(extractMemories).toHaveBeenCalledWith("I feel dizzy", "Drink water.");
    expect(saveMemories).toHaveBeenCalledTimes(1);
  });

  it("carries a reminderSuggestion on the done frame", async () => {
    detectReminder.mockResolvedValue({ kind: "MEDICATION", label: "take meds", frequency: "DAILY", hour: 8, minute: 0 });

    const frames = await readFrames((await POST(streamReq({ message: "remind me at 8" }))) as Response);
    const done = frames[frames.length - 1];
    expect(done.type).toBe("done");
    expect((done.reminderSuggestion as { label: string }).label).toBe("take meds");
  });

  it("emits an error frame and saves the partial reply when the stream breaks", async () => {
    runAmeliaTurnStream.mockImplementation(async function* () {
      yield { type: "start", meta: { urgency: "routine", redFlags: [], disclaimer: "d" } };
      yield { type: "delta", text: "Partial" };
      throw new Error("upstream died");
    });

    const frames = await readFrames((await POST(streamReq({ message: "I feel dizzy" }))) as Response);
    expect(frames[frames.length - 1].type).toBe("error");
    expect(msgCreate).toHaveBeenCalledTimes(2);
    expect(msgCreate.mock.calls[1]).toEqual([
      { data: { conversationId: "c1", role: "assistant", content: "Partial" } },
    ]);
  });

  it("401s when unauthenticated before opening a stream", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(streamReq({ message: "hi" }));
    expect(res.status).toBe(401);
  });
});
