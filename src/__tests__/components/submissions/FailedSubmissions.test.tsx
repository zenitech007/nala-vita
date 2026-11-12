import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StaffPage from "@/app/(admin)/admin/staff/page";
import VitalsPage from "@/app/(patient)/patient/vitals/page";

test("a rejected staff status change retains the confirmed state and shows the server error", async () => {
  global.fetch = jest.fn(async (_url, options) => options?.method === "PATCH"
    ? { ok: false, status: 403, json: async () => ({ error: "Cannot change this staff account." }) }
    : { ok: true, status: 200, json: async () => ({ staff: [{
      id: "d1", name: "Synthetic Doctor", email: "synthetic@example.test", role: "DOCTOR", speciality: "Cardiology",
      licenceNumber: "SYNTHETIC", department: "Cardiology", isActive: true, joinedAt: "2026-01-01",
    }] }) }) as jest.Mock;
  render(<StaffPage />);
  const active = await screen.findByText("Active", { selector: "span" });
  fireEvent.click(active.parentElement!.querySelector("button")!);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Cannot change this staff account"));
  expect(screen.getByText("Active", { selector: "span" })).toBeInTheDocument();
});

test("a rejected vital submission retains the draft and never claims success", async () => {
  global.fetch = jest.fn(async (_url, options) => options?.method === "POST"
    ? { ok: false, status: 422, json: async () => ({ error: "Invalid vital reading." }) }
    : { ok: true, status: 200, json: async () => ({ vitals: [] }) }) as jest.Mock;
  render(<VitalsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Record Vital" }));
  const input = screen.getByPlaceholderText("120/80");
  fireEvent.change(input, { target: { value: "120/80" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Reading" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Invalid vital reading"));
  expect(input).toHaveValue("120/80");
  expect(screen.queryByText("Vital recorded successfully!")).not.toBeInTheDocument();
});
