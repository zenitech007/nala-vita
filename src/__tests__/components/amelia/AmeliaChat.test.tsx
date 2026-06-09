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

beforeEach(() => {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ conversationId: "c1", reply: { content: "Stay hydrated. Confirm with a doctor.", urgency: "routine", redFlags: [], disclaimer: "d" } }),
  })) as unknown as jest.Mock;
});

describe("AmeliaChat", () => {
  it("renders the greeting and disclaimer", () => {
    render(<AmeliaChat />);
    expect(screen.getByText(/Tell me how you/i)).toBeInTheDocument();
    expect(screen.getByText(/not a substitute/i)).toBeInTheDocument();
  });

  it("sends a message and renders Amelia's reply", async () => {
    render(<AmeliaChat />);
    fireEvent.change(screen.getByLabelText("message"), { target: { value: "I feel dehydrated" } });
    fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(screen.getByText(/Stay hydrated/)).toBeInTheDocument());
  });
});
