// src/__tests__/helpers/sse.tsx
// Test helpers for the SSE-based Amelia chat endpoint.
import { jest } from "@jest/globals";

/** Builds a Response-like object whose body streams the given SSE frames. */
export function sseResponse(frames: Record<string, unknown>[]) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    status: 200,
    headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? "text/event-stream" : null) },
    body: {
      getReader: () => ({
        read: async () =>
          i < frames.length
            ? { done: false, value: encoder.encode(`data: ${JSON.stringify(frames[i++])}\n\n`) }
            : { done: true, value: undefined },
      }),
    },
  };
}

/** Response-like object for the plain-JSON endpoints (conversations list, errors). */
export function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? "application/json" : null) },
    json: async () => body,
  };
}

export interface MockChatOptions {
  /** SSE frames returned by POST /api/amelia/chat. */
  frames?: Record<string, unknown>[];
  /** Conversation summaries returned by the sidebar list endpoint. */
  conversations?: { id: string; title: string; updatedAt: string }[];
  /** Conversation resumed on mount by `?latest=1`. */
  latest?: { id: string; messages: { role: string; content: string; sentAt: string }[] } | null;
}

/**
 * Installs a global.fetch that routes Amelia's endpoints to canned responses.
 * Returns the mock so tests can assert on the calls made.
 */
export function mockAmeliaFetch(opts: MockChatOptions = {}) {
  const {
    frames = [
      { type: "meta", conversationId: "c1" },
      { type: "start", urgency: "routine", redFlags: [], disclaimer: "d" },
      { type: "delta", text: "Stay hydrated. " },
      { type: "delta", text: "Confirm with a doctor." },
      { type: "done", conversationId: "c1", reminderSuggestion: null },
    ],
    conversations = [],
    latest = null,
  } = opts;

  const fetchMock = jest.fn(async (url: unknown, init?: { method?: string }) => {
    const href = String(url);

    if (href.includes("/api/amelia/conversations")) {
      if (init?.method === "DELETE") return jsonResponse({ ok: true });
      if (href.includes("latest=1")) return jsonResponse({ conversations, latest });
      // Single-conversation fetch, e.g. /api/amelia/conversations/c2
      const match = href.match(/\/api\/amelia\/conversations\/([^?]+)/);
      if (match) {
        const found = latest && latest.id === match[1] ? latest : { id: match[1], messages: [] };
        return jsonResponse({ conversation: found });
      }
      return jsonResponse({ conversations });
    }

    if (href.includes("/api/amelia/chat")) return sseResponse(frames);

    return jsonResponse({});
  });

  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  return fetchMock;
}
