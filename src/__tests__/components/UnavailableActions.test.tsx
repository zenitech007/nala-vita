import { render, screen, fireEvent } from "@testing-library/react";
import PharmacyPage from "@/app/(patient)/patient/pharmacy/page";
import BedsPage from "@/app/(admin)/admin/beds/page";
import StaffPage from "@/app/(admin)/admin/staff/page";

test("pharmacy order submission is explicitly unavailable", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ medications: [{
    id: "rx", medication: "Synthetic medicine", dosage: "1mg", refillsAllowed: 2, refillsUsed: 0, prescribedAt: "2026-01-01", isActive: true,
  }] }) });
  render(<PharmacyPage />);
  await screen.findByText("Synthetic medicine");
  expect(screen.getByRole("button", { name: /^Order/i })).toBeDisabled();
});
test("bed discharge cannot simulate a saved operation", () => {
  render(<BedsPage />);
  fireEvent.click(screen.getAllByRole("button", { name: /^01/ })[0]);
  expect(screen.getByRole("button", { name: /Discharge Patient/i })).toBeDisabled();
});
test("staff creation is unavailable and there is no nurse role option", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ staff: [] }) });
  render(<StaffPage />);
  expect(await screen.findByRole("button", { name: /Add Staff/i })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Nurses" })).not.toBeInTheDocument();
});
