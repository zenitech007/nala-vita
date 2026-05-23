import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { SectionCard } from "@/components/ui/SectionCard";

describe("SectionCard", () => {
  it("renders children", () => {
    render(
      <SectionCard>
        <span>Content here</span>
      </SectionCard>
    );
    expect(screen.getByText(/content here/i)).toBeInTheDocument();
  });

  it("renders the title when provided", () => {
    render(
      <SectionCard title="Recent activity">
        <span>x</span>
      </SectionCard>
    );
    expect(screen.getByRole("heading", { name: /recent activity/i })).toBeInTheDocument();
  });

  it("renders the action when provided", () => {
    render(
      <SectionCard title="X" action={<a href="/x">View all</a>}>
        <span>y</span>
      </SectionCard>
    );
    expect(screen.getByRole("link", { name: /view all/i })).toBeInTheDocument();
  });

  it("does not render header when neither title nor action provided", () => {
    const { container } = render(
      <SectionCard>
        <span>x</span>
      </SectionCard>
    );
    expect(container.querySelector("h2")).toBeNull();
  });
});
