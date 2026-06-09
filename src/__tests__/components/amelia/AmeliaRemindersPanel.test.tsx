// src/__tests__/components/amelia/AmeliaRemindersPanel.test.tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AmeliaRemindersPanel from "@/components/amelia/AmeliaRemindersPanel";

function mockFetch() {
  const calls: { url: string; method: string }[] = [];
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async (url: string, opts?: { method?: string }) => {
    calls.push({ url, method: opts?.method ?? "GET" });
    if ((opts?.method ?? "GET") === "GET") {
      return { ok: true, json: async () => ({ reminders: [{ id: "1", kind: "MEDICATION", label: "take BP meds", frequency: "DAILY", nextFireAt: "x", schedule: "every day at 8:00 AM" }] }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  }) as unknown as jest.Mock;
  return calls;
}

beforeEach(() => mockFetch());

describe("AmeliaRemindersPanel", () => {
  it("lists active reminders with their schedule", async () => {
    render(<AmeliaRemindersPanel />);
    await waitFor(() => expect(screen.getByText("take BP meds")).toBeInTheDocument());
    expect(screen.getByText("every day at 8:00 AM")).toBeInTheDocument();
  });

  it("cancels a reminder via DELETE", async () => {
    const calls = mockFetch();
    render(<AmeliaRemindersPanel />);
    await waitFor(() => expect(screen.getByText("take BP meds")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url.includes("/api/amelia/reminders/1"))).toBe(true));
  });
});
