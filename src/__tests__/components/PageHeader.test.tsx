import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "@/components/ui/PageHeader";

describe("PageHeader", () => {
  it("renders the title", () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByRole("heading", { level: 1, name: /dashboard/i })).toBeInTheDocument();
  });

  it("renders the subtitle when provided", () => {
    render(<PageHeader title="X" subtitle="Welcome back" />);
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });

  it("renders the action node when provided", () => {
    render(<PageHeader title="X" action={<button>Save</button>} />);
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("does NOT render subtitle if absent", () => {
    const { container } = render(<PageHeader title="X" />);
    expect(container.querySelector("p")).toBeNull();
  });
});
