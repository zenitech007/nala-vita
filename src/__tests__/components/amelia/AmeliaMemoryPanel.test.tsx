import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AmeliaMemoryPanel from "@/components/amelia/AmeliaMemoryPanel";

function mockFetchSequence() {
  const calls: { url: string; method: string }[] = [];
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async (url: string, opts?: { method?: string }) => {
    calls.push({ url, method: opts?.method ?? "GET" });
    if ((opts?.method ?? "GET") === "GET") {
      return { ok: true, json: async () => ({ memories: [
        { id: "1", kind: "ALLERGY", value: "penicillin", confirmedByUser: false },
        { id: "2", kind: "PREFERENCE", value: "morning visits", confirmedByUser: true },
      ] }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  }) as unknown as jest.Mock;
  return calls;
}

beforeEach(() => mockFetchSequence());

describe("AmeliaMemoryPanel", () => {
  it("loads and lists memories with a Confirm button on the pending high-stakes item", async () => {
    render(<AmeliaMemoryPanel />);
    await waitFor(() => expect(screen.getByText("penicillin")).toBeInTheDocument());
    expect(screen.getByText("morning visits")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
  });

  it("confirming a memory PATCHes it", async () => {
    const calls = mockFetchSequence();
    render(<AmeliaMemoryPanel />);
    await waitFor(() => expect(screen.getByText("penicillin")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH" && c.url.includes("/api/amelia/memory/1"))).toBe(true));
  });
});
