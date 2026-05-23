import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import AddMedicationModal from "@/components/medications/AddMedicationModal";

const onClose = jest.fn();
const onAdd = jest.fn().mockImplementation(() => Promise.resolve());

beforeEach(() => {
  onClose.mockClear();
  onAdd.mockClear();
});

describe("AddMedicationModal", () => {
  it("does not render form when isOpen is false", () => {
    const { container } = render(
      <AddMedicationModal isOpen={false} onClose={onClose} onAdd={onAdd} />
    );
    expect(container.querySelector("form")).toBeNull();
  });

  it("renders name, dosage, and frequency inputs when open", () => {
    render(<AddMedicationModal isOpen={true} onClose={onClose} onAdd={onAdd} />);
    expect(screen.getByPlaceholderText(/vitamin c/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/500mg|pills/i)).toBeInTheDocument();
    // Frequency select uses the value "Once daily" by default
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    render(<AddMedicationModal isOpen={true} onClose={onClose} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onAdd with form data on submit", async () => {
    render(<AddMedicationModal isOpen={true} onClose={onClose} onAdd={onAdd} />);

    fireEvent.change(screen.getByPlaceholderText(/vitamin c/i), {
      target: { value: "Lisinopril" },
    });
    fireEvent.change(screen.getByPlaceholderText(/500mg|pills/i), {
      target: { value: "10mg" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add to schedule/i }));

    // Let microtasks resolve
    await new Promise((r) => setTimeout(r, 50));

    expect(onAdd).toHaveBeenCalled();
    const arg = onAdd.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.name).toBe("Lisinopril");
    expect(arg.dosage).toBe("10mg");
    expect(arg.frequency).toBe("Once daily");
    expect(Array.isArray(arg.times)).toBe(true);
  });
});
