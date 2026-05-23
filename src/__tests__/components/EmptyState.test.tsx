import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="No appointments yet" />);
    expect(screen.getByRole("heading", { name: /no appointments yet/i })).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(<EmptyState title="X" description="Book your first appointment to get started." />);
    expect(screen.getByText(/book your first appointment/i)).toBeInTheDocument();
  });

  it("renders the action when provided", () => {
    render(<EmptyState title="X" action={<button>Book now</button>} />);
    expect(screen.getByRole("button", { name: /book now/i })).toBeInTheDocument();
  });
});
