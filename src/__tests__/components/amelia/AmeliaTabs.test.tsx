import { describe, it, expect, jest } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("@/components/amelia/AmeliaChat", () => ({ __esModule: true, default: () => <div data-testid="chat" /> }));
jest.mock("@/components/amelia/AmeliaMemoryPanel", () => ({ __esModule: true, default: () => <div data-testid="panel" /> }));

import AmeliaTabs from "@/components/amelia/AmeliaTabs";

describe("AmeliaTabs", () => {
  it("shows chat by default and switches to the memory panel", () => {
    render(<AmeliaTabs />);
    expect(screen.getByTestId("chat")).toBeInTheDocument();
    expect(screen.queryByTestId("panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /what amelia knows/i }));
    expect(screen.getByTestId("panel")).toBeInTheDocument();
    expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
  });
});
