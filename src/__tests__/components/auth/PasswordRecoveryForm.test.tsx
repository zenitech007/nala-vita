import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PasswordRecoveryForm from "@/components/auth/PasswordRecoveryForm";

test("keeps the email draft and announces a recovery request failure", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Please wait before requesting another link." }) });
  render(<PasswordRecoveryForm mode="request" />);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "synthetic@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Please wait"));
  expect(screen.getByLabelText("Email address")).toHaveValue("synthetic@example.test");
});

test("requires matching password confirmation before sending", () => {
  global.fetch = jest.fn();
  render(<PasswordRecoveryForm mode="update" />);
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "synthetic-password" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
  expect(screen.getByRole("alert")).toHaveTextContent("must match");
  expect(global.fetch).not.toHaveBeenCalled();
});
