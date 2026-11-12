import { render, screen } from "@testing-library/react";
import PharmacyPage from "@/app/(patient)/patient/pharmacy/page";

test("reads the medications API envelope", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ medications: [{
    id: "rx", medication: "Synthetic medicine", dosage: "1mg", refillsAllowed: 2, refillsUsed: 0,
    prescribedAt: "2026-01-01T00:00:00Z", isActive: true,
  }] }) });
  render(<PharmacyPage />);
  expect(await screen.findByText("Synthetic medicine")).toBeInTheDocument();
});
