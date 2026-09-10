// src/__tests__/components/amelia/AmeliaChat.test.tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("@/components/chat/ChatMessage", () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <div data-testid="msg">{content}</div>,
}));
jest.mock("@/components/chat/TypingIndicator", () => ({
  __esModule: true,
  default: () => <div data-testid="typing" />,
}));
jest.mock("@/components/chat/ChatInput", () => ({
  __esModule: true,
  default: ({ value, onChange, onSend }: { value: string; onChange: (v: string) => void; onSend: () => void }) => (
    <div>
      <textarea aria-label="message" value={value} onChange={(e) => onChange(e.target.value)} />
      <button onClick={() => onSend()}>send</button>
    </div>
  ),
}));

import AmeliaChat from "@/components/amelia/AmeliaChat";
import { mockAmeliaFetch } from "../../helpers/sse";

beforeEach(() => {
  mockAmeliaFetch();
});

describe("AmeliaChat", () => {
  it("renders the greeting and disclaimer", () => {
    render(<AmeliaChat />);
    expect(screen.getByText(/Tell me how you/i)).toBeInTheDocument();
    expect(screen.getByText(/not a substitute/i)).toBeInTheDocument();
  });

  it("streams Amelia's reply into a single message bubble", async () => {
    render(<AmeliaChat />);
    fireEvent.change(screen.getByLabelText("message"), { target: { value: "I feel dehydrated" } });
    fireEvent.click(screen.getByText("send"));

    // Both deltas must land in one bubble, not two.
    await waitFor(() =>
      expect(screen.getByText("Stay hydrated. Confirm with a doctor.")).toBeInTheDocument()
    );
  });

  it("restores a previous conversation on mount", async () => {
    mockAmeliaFetch({
      conversations: [{ id: "c1", title: "Thumb swelling", updatedAt: "2026-08-01T10:00:00.000Z" }],
      latest: {
        id: "c1",
        messages: [
          { role: "user", content: "my thumb is puffy", sentAt: "2026-08-01T10:00:00.000Z" },
          { role: "assistant", content: "Let's look at that.", sentAt: "2026-08-01T10:00:05.000Z" },
        ],
      },
    });

    render(<AmeliaChat />);

    await waitFor(() => expect(screen.getByText("my thumb is puffy")).toBeInTheDocument());
    expect(screen.getByText("Let's look at that.")).toBeInTheDocument();
    // The greeting should be gone once history is restored.
    expect(screen.queryByText(/Tell me how you/i)).not.toBeInTheDocument();
  });

  it("lists past conversations and starts a new one on demand", async () => {
    mockAmeliaFetch({
      conversations: [{ id: "c1", title: "Thumb swelling", updatedAt: "2026-08-01T10:00:00.000Z" }],
      latest: {
        id: "c1",
        messages: [{ role: "user", content: "my thumb is puffy", sentAt: "2026-08-01T10:00:00.000Z" }],
      },
    });

    render(<AmeliaChat />);
    await waitFor(() => expect(screen.getByText("Thumb swelling")).toBeInTheDocument());

    fireEvent.click(screen.getByText("New chat"));

    // Transcript clears back to the greeting; the sidebar entry remains.
    expect(screen.queryByText("my thumb is puffy")).not.toBeInTheDocument();
    expect(screen.getByText(/Tell me how you/i)).toBeInTheDocument();
    expect(screen.getByText("Thumb swelling")).toBeInTheDocument();
  });

  it("surfaces a rate-limit error as a message instead of crashing", async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async (url: unknown) => {
      if (String(url).includes("/api/amelia/conversations")) {
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ conversations: [], latest: null }) };
      }
      return {
        ok: false,
        status: 429,
        headers: { get: () => "application/json" },
        json: async () => ({ error: "Too many requests. Please slow down." }),
      };
    }) as unknown as jest.Mock;

    render(<AmeliaChat />);
    fireEvent.change(screen.getByLabelText("message"), { target: { value: "hello" } });
    fireEvent.click(screen.getByText("send"));

    await waitFor(() => expect(screen.getByText(/Too many requests/i)).toBeInTheDocument());
  });

  it("shows the emergency banner when the stream reports an emergency", async () => {
    mockAmeliaFetch({
      frames: [
        { type: "meta", conversationId: "c1" },
        { type: "start", urgency: "emergency", redFlags: [{ pattern: "x", reason: "Possible cardiac emergency" }], disclaimer: "d" },
        { type: "delta", text: "Please seek emergency care now." },
        { type: "done", conversationId: "c1", reminderSuggestion: null },
      ],
    });

    render(<AmeliaChat />);
    fireEvent.change(screen.getByLabelText("message"), { target: { value: "crushing chest pain" } });
    fireEvent.click(screen.getByText("send"));

    await waitFor(() => expect(screen.getByText(/Possible emergency/i)).toBeInTheDocument());
  });
});
