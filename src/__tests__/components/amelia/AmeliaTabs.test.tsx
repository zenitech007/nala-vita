// src/__tests__/components/amelia/AmeliaTabs.test.tsx
import { describe, it, expect, jest } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("@/components/amelia/AmeliaChat", () => ({ __esModule: true, default: () => <div data-testid="chat" /> }));
jest.mock("@/components/amelia/AmeliaMemoryPanel", () => ({ __esModule: true, default: () => <div data-testid="panel" /> }));
jest.mock("@/components/amelia/AmeliaRemindersPanel", () => ({ __esModule: true, default: () => <div data-testid="reminders" /> }));

import AmeliaTabs from "@/components/amelia/AmeliaTabs";

describe("AmeliaTabs", () => {
  it("switches between chat, memory, and reminders", () => {
    render(<AmeliaTabs />);
    expect(screen.getByTestId("chat")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /what amelia knows/i }));
    expect(screen.getByTestId("panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reminders/i }));
    expect(screen.getByTestId("reminders")).toBeInTheDocument();
    expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
  });
});
