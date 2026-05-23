import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { render } from "@testing-library/react";
import PatientIntakeChart from "@/components/dashboard/PatientIntakeChart";

// Suppress recharts jsdom width(0)/height(0) warnings — non-fatal but noisy.
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args: unknown[]) => {
    const s = String(args[0] ?? "");
    if (s.includes("width(0)") || s.includes("height(0)") || s.includes("ResponsiveContainer")) return;
    originalWarn(...args);
  };
});
afterAll(() => {
  console.warn = originalWarn;
});

describe("PatientIntakeChart", () => {
  it("renders with empty data without crashing", () => {
    const { container } = render(<PatientIntakeChart data={[]} />);
    expect(container).toBeInTheDocument();
  });

  it("renders with sample data", () => {
    const sample = [
      { name: "Mon", newPatients: 12, aiDiagnoses: 8 },
      { name: "Tue", newPatients: 19, aiDiagnoses: 15 },
    ];
    const { container } = render(<PatientIntakeChart data={sample} />);
    expect(container).toBeInTheDocument();
  });
});
