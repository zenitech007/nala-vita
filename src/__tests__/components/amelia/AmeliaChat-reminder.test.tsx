// src/__tests__/components/amelia/AmeliaChat-reminder.test.tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("@/components/chat/ChatMessage", () => ({ __esModule: true, default: ({ content }: { content: string }) => <div>{content}</div> }));
jest.mock("@/components/chat/TypingIndicator", () => ({ __esModule: true, default: () => <div /> }));
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
  mockAmeliaFetch({
    frames: [
      { type: "meta", conversationId: "c1" },
      { type: "start", urgency: "routine", redFlags: [], disclaimer: "d" },
      { type: "delta", text: "Sure!" },
      {
        type: "done",
        conversationId: "c1",
        reminderSuggestion: { kind: "MEDICATION", label: "take meds", frequency: "DAILY", nextFireAt: "2026-06-12T08:00:00.000Z", schedule: "every day at 8:00 AM" },
      },
    ],
  });
});

describe("AmeliaChat reminder card", () => {
  it("renders a ReminderCard when the done frame carries a reminderSuggestion", async () => {
    render(<AmeliaChat />);
    fireEvent.change(screen.getByLabelText("message"), { target: { value: "remind me to take meds at 8" } });
    fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(screen.getByRole("button", { name: /set reminder/i })).toBeInTheDocument(), { timeout: 5000 });
  });
});
