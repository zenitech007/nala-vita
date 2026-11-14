import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HealthDashboard from "@/components/dashboard/HealthDashboard";

const onUpdate = jest.fn().mockImplementation(() => Promise.resolve());

beforeEach(() => onUpdate.mockClear());

describe("HealthDashboard", () => {
  it("renders hydration, medication, and steps sections", () => {
    render(<HealthDashboard />);
    expect(screen.getByText(/hydration/i)).toBeInTheDocument();
    expect(screen.getByRole("heading",{name:"Medication"})).toBeInTheDocument();
    expect(screen.getByText(/steps/i)).toBeInTheDocument();
  });

  it("uses initialVitals when provided", () => {
    render(
      <HealthDashboard
        initialVitals={{ waterLiters: 2.5, steps: 8000, medsTaken: true }}
      />
    );
    // water value visible
    expect(screen.getByText("2.5")).toBeInTheDocument();
    // steps shown in input
    const stepsInput = screen.getByPlaceholderText("0") as HTMLInputElement;
    expect(stepsInput.value).toBe("8000");
    // meds taken state surface
    expect(screen.getByText(/taken today/i)).toBeInTheDocument();
  });

  it("increments water and calls onUpdate when Add is clicked", async () => {
    render(
      <HealthDashboard
        initialVitals={{ waterLiters: 1, steps: 0, medsTaken: false }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /add 250ml/i }));
    await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("Daily vitals saved"));

    expect(onUpdate).toHaveBeenCalled();
    const arg = onUpdate.mock.calls[0][0] as { waterLiters: number };
    expect(arg.waterLiters).toBeCloseTo(1.25, 2);
  });

  it("toggles medsTaken on the Medication card click", async () => {
    render(
      <HealthDashboard
        initialVitals={{ waterLiters: 0, steps: 0, medsTaken: false }}
        onUpdate={onUpdate}
      />
    );

    // The card itself is clickable — find by the "Tap to log" hint then walk up to clickable
    const tapHint = screen.getByText(/tap to log/i);
    const card = tapHint.closest("div[class*='cursor-pointer']") as HTMLElement;
    fireEvent.click(card);
    await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("Daily vitals saved"));

    expect(onUpdate).toHaveBeenCalled();
    const arg = onUpdate.mock.calls[0][0] as { medsTaken: boolean };
    expect(arg.medsTaken).toBe(true);
  });
});

it("keeps the daily draft and reports save failures without a saved claim",async()=>{
 const failure=jest.fn<()=>Promise<void>>().mockRejectedValue(new Error("Unable to save daily vitals"));
 render(<HealthDashboard initialVitals={{waterLiters:1,steps:0,medsTaken:false}} onUpdate={failure}/>);
 fireEvent.click(screen.getByRole("button",{name:/add 250ml/i}));
 await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("Unable to save daily vitals"));
 expect(screen.getByText("1.25")).toBeInTheDocument();expect(screen.queryByText("Daily vitals saved")).not.toBeInTheDocument();
});
