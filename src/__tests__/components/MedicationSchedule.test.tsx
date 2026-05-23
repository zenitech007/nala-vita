import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import MedicationSchedule from "@/components/medications/MedicationSchedule";

describe("MedicationSchedule", () => {
  it("renders empty state when there are no medications", () => {
    render(<MedicationSchedule medications={[]} />);
    expect(screen.getByText(/no active medications/i)).toBeInTheDocument();
  });

  it("renders one card per medication", () => {
    render(
      <MedicationSchedule
        medications={[
          { name: "Lisinopril", dosage: "10mg", frequency: "Once daily" },
          { name: "Metformin", dosage: "500mg", frequency: "Twice daily" },
        ]}
      />
    );
    expect(screen.getByText(/lisinopril/i)).toBeInTheDocument();
    expect(screen.getByText(/metformin/i)).toBeInTheDocument();
  });

  it("shows dosage and frequency", () => {
    render(
      <MedicationSchedule
        medications={[
          { name: "Lisinopril", dosage: "10mg", frequency: "Once daily" },
        ]}
      />
    );
    expect(screen.getByText("10mg")).toBeInTheDocument();
    expect(screen.getByText(/once daily/i)).toBeInTheDocument();
  });

  it("renders instructions when provided", () => {
    render(
      <MedicationSchedule
        medications={[
          {
            name: "Lisinopril",
            dosage: "10mg",
            frequency: "Once daily",
            instructions: "Take with food",
          },
        ]}
      />
    );
    expect(screen.getByText(/take with food/i)).toBeInTheDocument();
  });
});
