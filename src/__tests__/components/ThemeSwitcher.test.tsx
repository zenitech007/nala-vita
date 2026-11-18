import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

// Mock next-themes — capture setTheme calls
const setTheme = jest.fn();
jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme }),
}));

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    setTheme.mockClear();
    localStorage.clear();
    document.documentElement.className = "dark";
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

  it("keeps brightness when selecting a brand", () => {
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /ocean/i }));
    expect(setTheme).not.toHaveBeenCalled();
    expect(localStorage.getItem("nala-brand")).toBe("ocean");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("wraps buttons in a group with an accessible label", () => {
    render(<ThemeSwitcher />);
    expect(screen.getByRole("group", { name: /color theme/i })).toHaveAccessibleName(/color theme/i);
  });
});

it("changes brightness without overwriting the brand preference", () => {
  localStorage.setItem("nala-brand", "emerald");
  render(<ThemeSwitcher />);
  fireEvent.change(screen.getByRole("combobox", { name: "Brightness" }), { target: { value: "light" } });
  expect(setTheme).toHaveBeenCalledWith("light");
  expect(localStorage.getItem("nala-brand")).toBe("emerald");
});
