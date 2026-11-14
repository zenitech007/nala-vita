import {render,screen,fireEvent} from "@testing-library/react";
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
