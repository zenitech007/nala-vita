import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import {PATIENT_NAV} from "@/lib/nav-config";
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render as rtlRender, screen, fireEvent } from "@testing-library/react";
import { SidebarShell } from "@/components/layout/SidebarShell";
import { LayoutDashboard, Settings as SettingsIcon } from "lucide-react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/patient/dashboard",
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { auth: { signOut: jest.fn<()=>Promise<{error:null}>>().mockResolvedValue({ error: null }) } },
}));

import { supabase } from "@/lib/supabase";
const signOut = supabase.auth.signOut as jest.Mock;

const render=rtlRender;
const translations=jest.fn<()=>Record<string,string>>(()=>en.nav);
jest.mock("next-intl",()=>({useTranslations:()=> (key:string)=>translations()[key]}));

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/patient/dashboard" },
  { icon: SettingsIcon, label: "Other", href: "/patient/other" },
];

beforeEach(() => {
  translations.mockReturnValue(en.nav);
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

it("mobile menu uses a modal focus boundary and restores its opener",()=>{
 render(<SidebarShell role="patient" roleLabel="Patient" user={null} nav={NAV}/>);
 const opener=screen.getByRole("button",{name:"Open menu"});opener.focus();fireEvent.click(opener);
 const dialog=screen.getByRole("dialog",{name:"Navigation menu"});expect(dialog).toHaveAttribute("aria-modal","true");
 expect(screen.getByRole("button",{name:"Close menu"})).toHaveFocus();fireEvent.keyDown(document.activeElement!,{key:"Escape"});
 expect(screen.queryByRole("dialog",{name:"Navigation menu"})).not.toBeInTheDocument();expect(opener).toHaveFocus();
});

it("uses the selected locale for built-in navigation",()=>{
 translations.mockReturnValue(fr.nav);
 rtlRender(<SidebarShell role="patient" roleLabel="Patient" user={null} nav={PATIENT_NAV}/>);
 expect(screen.getByRole("link",{name:"Rendez-vous"})).toBeInTheDocument();
});
