import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

// Mock next-themes — capture setTheme calls
const setTheme = jest.fn();
jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "theme-rose", setTheme }),
}));

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    setTheme.mockClear();
  });

  it("renders one button per theme", () => {
    render(<ThemeSwitcher />);
    expect(screen.getByRole("button", { name: /rose/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fuchsia/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ocean/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /emerald/i })).toBeInTheDocument();
  });

  it("marks the active theme with aria-pressed=true", () => {
    render(<ThemeSwitcher />);
    expect(screen.getByRole("button", { name: /rose/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /ocean/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls setTheme on click", () => {
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /ocean/i }));
    expect(setTheme).toHaveBeenCalledWith("theme-ocean");
  });

  it("wraps buttons in a group with an accessible label", () => {
    render(<ThemeSwitcher />);
    expect(screen.getByRole("group")).toHaveAccessibleName(/color theme/i);
  });
});
