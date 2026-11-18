import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DoctorVerificationQueue from "@/components/admin/DoctorVerificationQueue";
const doctor = { id: "d1", specialization: "Cardiology", licenseNumber: "SYNTHETIC", updatedAt: "2026-11-11T08:00:00.000Z", isVerified: false, user: { firstName: "Synthetic", lastName: "Doctor", isActive: true }, verification: { status: "PENDING", reason: null, reviewer: null, reviewedAt: null } };
test("requires a reason and submits an explicit decision with the record version", async () => {
  global.fetch = jest.fn(async (_url, options) => ({ ok: true, status: 200, json: async () => options?.method === "PATCH" ? { emailStatus: "sent" } : { doctors: [doctor] } })) as jest.Mock;
  render(<DoctorVerificationQueue />);
  await screen.findByText("Synthetic Doctor");
  expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Review reason"), { target: { value: "Synthetic review complete" } });
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  await screen.findByText("Decision saved. Notification email sent.");
  expect(global.fetch).toHaveBeenCalledWith("/api/admin/doctors/d1/verification", expect.objectContaining({
    body: JSON.stringify({ status: "VERIFIED", reason: "Synthetic review complete", expectedUpdatedAt: doctor.updatedAt }),
  }));
});
test("retains the review reason after a failed conditional save", async () => {
  global.fetch = jest.fn(async (_url, options) => options?.method === "PATCH"
    ? { ok: false, status: 409, json: async () => ({ error: "Refresh before reviewing again." }) }
    : { ok: true, status: 200, json: async () => ({ doctors: [doctor] }) }) as jest.Mock;
  render(<DoctorVerificationQueue />);
  await screen.findByText("Synthetic Doctor");
  fireEvent.change(screen.getByLabelText("Review reason"), { target: { value: "Needs another review" } });
  fireEvent.click(screen.getByRole("button", { name: "Reject" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Refresh"));
  expect(screen.getByLabelText("Review reason")).toHaveValue("Needs another review");
});
