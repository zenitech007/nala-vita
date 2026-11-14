import fr from "../../../messages/fr.json";
import yo from "../../../messages/yo.json";
import ha from "../../../messages/ha.json";
import ig from "../../../messages/ig.json";
import en from "../../../messages/en.json";
let authMessages:Record<string,string>=en.auth;
beforeEach(()=>{authMessages=en.auth;});
jest.mock("next-intl",()=>({useTranslations:()=> (key:string,values:Record<string,string|number>={})=>authMessages[key]?.replace(/\{(\w+)\}/g,(_match:string,name:string)=>String(values[name]))}));
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import Login from "@/app/(auth)/login/page";
import Register from "@/app/(auth)/register/page";
jest.mock("next/navigation",()=>({useRouter:()=>({push:jest.fn(),refresh:jest.fn()})}));
jest.mock("@/lib/supabase",()=>({supabase:{auth:{signInWithPassword:jest.fn()}}}));
test("login labels, toggle and validation errors are associated",async()=>{
 render(<Login/>);const email=screen.getByLabelText("Email");const password=screen.getByLabelText("Password");
 fireEvent.click(screen.getByRole("button",{name:"Show password"}));expect(password).toHaveAttribute("type","text");
 expect(screen.getByRole("button",{name:"Hide password"})).toHaveAttribute("aria-pressed","true");
 fireEvent.click(screen.getByRole("button",{name:"Log In"}));await waitFor(()=>expect(email).toHaveAttribute("aria-invalid","true"));
 expect(document.getElementById(email.getAttribute("aria-describedby")!)).toHaveTextContent("Invalid email address");
});
test("registration fields and conditional clinician fields have labels",()=>{
 render(<Register/>);expect(screen.getByLabelText("First Name")).toHaveAttribute("id");expect(screen.getByLabelText("Date of Birth")).toHaveAttribute("id");
 fireEvent.click(screen.getByRole("radio",{name:"Doctor"}));expect(screen.getByLabelText("Medical License Number")).toHaveAttribute("id");
 expect(screen.getByRole("button",{name:"Show password"})).toBeInTheDocument();
});

test.each([["en",en],["fr",fr],["yo",yo],["ha",ha],["ig",ig]] as const)("login displays %s labels and validation messages",async(_locale,catalog)=>{
 authMessages=catalog.auth;
 render(<Login/>);const email=screen.getByLabelText(catalog.auth.email);expect(screen.getByLabelText(catalog.auth.password)).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:catalog.auth.login}));
 await waitFor(()=>expect(email).toHaveAttribute("aria-invalid","true"));expect(screen.getByText(catalog.auth.invalidEmail)).toBeInTheDocument();
});
