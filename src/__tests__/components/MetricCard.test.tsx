import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { MetricCard } from "@/components/ui/MetricCard";

describe("MetricCard", () => {
  it("renders label and value", () => {
    render(<MetricCard label="Patients today" value={42} />);
    expect(screen.getByText(/patients today/i)).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders string values", () => {
    render(<MetricCard label="Revenue" value="₦12,000" />);
    expect(screen.getByText("₦12,000")).toBeInTheDocument();
  });

  it("renders trend when provided", () => {
    render(<MetricCard label="X" value={1} trend={{ direction: "up", value: "+12%" }} />);
    expect(screen.getByText("+12%")).toBeInTheDocument();
    expect(screen.getByText("↑")).toBeInTheDocument();
  });

  it("does not crash without optional props", () => {
    const { container } = render(<MetricCard label="X" value={0} />);
    expect(container).toBeInTheDocument();
  });
});
