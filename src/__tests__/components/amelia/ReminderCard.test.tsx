// src/__tests__/components/amelia/ReminderCard.test.tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ReminderCard from "@/components/amelia/ReminderCard";

const suggestion = { kind: "MEDICATION", label: "take BP meds", frequency: "DAILY", nextFireAt: "2026-06-12T08:00:00.000Z", schedule: "every day at 8:00 AM" };

beforeEach(() => {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as unknown as jest.Mock;
});

describe("ReminderCard", () => {
  it("shows the proposed schedule and a Set button", () => {
    render(<ReminderCard suggestion={suggestion} />);
    expect(screen.getByText(/take BP meds/)).toBeInTheDocument();
    expect(screen.getByText(/every day at 8:00 AM/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /set reminder/i })).toBeInTheDocument();
  });

  it("POSTs and shows confirmation on Set", async () => {
    render(<ReminderCard suggestion={suggestion} />);
    fireEvent.click(screen.getByRole("button", { name: /set reminder/i }));
    await waitFor(() => expect(screen.getByText(/Reminder set/i)).toBeInTheDocument());
    expect((global as unknown as { fetch: jest.Mock }).fetch).toHaveBeenCalledWith("/api/amelia/reminders", expect.objectContaining({ method: "POST" }));
  });

  it("dismisses on Not now", () => {
    const { container } = render(<ReminderCard suggestion={suggestion} />);
    fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    expect(container).toBeEmptyDOMElement();
  });
});
