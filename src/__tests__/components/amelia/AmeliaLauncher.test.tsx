// src/__tests__/components/amelia/AmeliaLauncher.test.tsx
import { describe, it, expect, jest } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("@/components/amelia/AmeliaChat", () => ({ __esModule: true, default: () => <div data-testid="amelia-chat" /> }));

import AmeliaLauncher from "@/components/amelia/AmeliaLauncher";

describe("AmeliaLauncher", () => {
  it("is closed by default and opens on click", () => {
    render(<AmeliaLauncher />);
    expect(screen.queryByTestId("amelia-chat")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /amelia/i }));
    expect(screen.getByTestId("amelia-chat")).toBeInTheDocument();
  });
});
