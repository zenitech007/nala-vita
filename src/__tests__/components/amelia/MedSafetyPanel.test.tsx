import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import MedSafetyPanel from "@/components/amelia/MedSafetyPanel";

function mockFetch(result: unknown, ok = true) {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async () => ({ ok, json: async () => ({ result }) })) as unknown as jest.Mock;
}

beforeEach(() => mockFetch({ interactions: [], dosingNotes: [], allergyConflicts: [], overallNote: "Confirm with a professional." }));

describe("MedSafetyPanel", () => {
  it("shows the no-concerns state when clean", async () => {
    render(<MedSafetyPanel />);
    await waitFor(() => expect(screen.getByText(/No concerns found/i)).toBeInTheDocument());
    expect(screen.getByText(/Confirm with a professional/i)).toBeInTheDocument();
  });

  it("renders an interaction with its severity", async () => {
    mockFetch({ interactions: [{ drugs: ["aspirin", "warfarin"], severity: "high", note: "bleeding risk" }], dosingNotes: [], allergyConflicts: [], overallNote: "x" });
    render(<MedSafetyPanel />);
    await waitFor(() => expect(screen.getByText(/bleeding risk/)).toBeInTheDocument());
    expect(screen.getByText(/high interaction/i)).toBeInTheDocument();
  });

  it("shows an error state when the request fails", async () => {
    mockFetch({}, false);
    render(<MedSafetyPanel />);
    await waitFor(() => expect(screen.getByText(/unavailable/i)).toBeInTheDocument());
  });
});
