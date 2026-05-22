import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import { SidebarShell } from "@/components/layout/SidebarShell";
import { LayoutDashboard, Settings as SettingsIcon } from "lucide-react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/patient/dashboard",
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { auth: { signOut: jest.fn().mockResolvedValue({ error: null }) } },
}));

import { supabase } from "@/lib/supabase";
const signOut = supabase.auth.signOut as jest.Mock;

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/patient/dashboard" },
  { icon: SettingsIcon, label: "Other", href: "/patient/other" },
];

beforeEach(() => {
  signOut.mockClear();
  localStorage.clear();
});

describe("SidebarShell", () => {
  it("renders one link per nav item", () => {
    render(<SidebarShell role="patient" roleLabel="Patient" user={null} nav={NAV} />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /other/i })).toBeInTheDocument();
  });

  it("marks the active link based on pathname prefix", () => {
    render(<SidebarShell role="patient" roleLabel="Patient" user={null} nav={NAV} />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /other/i })).not.toHaveAttribute("aria-current", "page");
  });

  it("shows the user name when provided", () => {
    render(<SidebarShell role="patient" roleLabel="Patient" user={{ firstName: "Ada", lastName: "L" }} nav={NAV} />);
    expect(screen.getByText(/Ada L/)).toBeInTheDocument();
  });

  it("toggles collapse on hamburger click and persists to localStorage", () => {
    render(<SidebarShell role="patient" roleLabel="Patient" user={null} nav={NAV} />);
    const toggle = screen.getByRole("button", { name: /toggle sidebar/i });
    expect(localStorage.getItem("sidebar-collapsed-patient")).toBeNull();
    fireEvent.click(toggle);
    expect(localStorage.getItem("sidebar-collapsed-patient")).toBe("true");
    fireEvent.click(toggle);
    expect(localStorage.getItem("sidebar-collapsed-patient")).toBe("false");
  });

  it("calls supabase.auth.signOut on Sign Out click", () => {
    render(<SidebarShell role="patient" roleLabel="Patient" user={null} nav={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
  });

  it("renders Sign Out button in red", () => {
    render(<SidebarShell role="patient" roleLabel="Patient" user={null} nav={NAV} />);
    const signOutBtn = screen.getByRole("button", { name: /sign out/i });
    expect(signOutBtn.className).toMatch(/text-red-/);
  });
});
