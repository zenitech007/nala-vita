import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import SettingsPanel from "@/components/settings/SettingsPanel";
jest.mock("next/navigation",()=>({useRouter:()=>({refresh:jest.fn()})}));
jest.mock("next-intl",()=>({useTranslations:()=> (key:string)=>key}));
jest.mock("@/components/ui/ThemeSwitcher",()=>({ThemeSwitcher:()=>null}));
beforeEach(()=>{global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({firstName:"Test",lastName:"Patient",patient:{}})});});
test("profile controls have names and server field errors are associated",async()=>{
 render(<SettingsPanel backHref="/patient/dashboard"/>);fireEvent.click(screen.getByRole("button",{name:/Profile & Medical/}));
 const field=await screen.findByLabelText("First Name");
 (global.fetch as jest.Mock).mockResolvedValueOnce({ok:false,json:async()=>({error:"Validation failed",details:[{path:["firstName"],message:"Name is too short"}]})});
 fireEvent.change(field,{target:{value:"A"}});fireEvent.submit(field.closest("form")!);
 await screen.findByText("Name is too short");expect(field).toHaveAttribute("aria-invalid","true");
 expect(document.getElementById(field.getAttribute("aria-describedby")!)).toHaveTextContent("Name is too short");expect(field).toHaveValue("A");
});

test("unsupported unit and notification controls are disabled and labelled",async()=>{
 render(<SettingsPanel backHref="/patient/dashboard"/>);
 expect(screen.getByRole("button",{name:/Metric \(kg/})).toBeDisabled();expect(screen.getByText(/Unit conversion preferences are unavailable/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Notifications"}));
 await waitFor(()=>expect(screen.queryByRole("switch",{name:"Toggle high contrast mode"})).not.toBeInTheDocument());
 for(const toggle of screen.getAllByRole("switch"))expect(toggle).toBeDisabled();
 expect(screen.getByText(/Notification delivery preferences are unavailable/)).toBeInTheDocument();
});
