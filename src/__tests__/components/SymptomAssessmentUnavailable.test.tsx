import {jest} from "@jest/globals";
import {render,screen,fireEvent} from "@testing-library/react";
import SymptomChecker from "@/app/(patient)/patient/symptom-checker/page";
const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;});
test("an unavailable assessment is announced and the symptom draft is retained",async()=>{
 global.fetch=jest.fn<typeof fetch>().mockResolvedValue({ok:false,status:503,json:async()=>({status:"unavailable",error:"AI assessment is unavailable. No assessment was generated."})} as Response);
 render(<SymptomChecker/>);
 fireEvent.click(screen.getByRole("button",{name:"Headache"}));
 fireEvent.change(screen.getByPlaceholderText(/The headache started/),{target:{value:"Synthetic symptom draft"}});
 fireEvent.click(screen.getByRole("button",{name:"Continue"}));
 fireEvent.click(screen.getByRole("button",{name:"Less than 24 hours"}));
 fireEvent.click(screen.getByRole("button",{name:"Get Assessment"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("No assessment was generated");
 expect(screen.getByRole("button",{name:"Get Assessment"})).toBeEnabled();
 fireEvent.click(screen.getByRole("button",{name:"Back"}));
 expect(screen.getByPlaceholderText(/The headache started/)).toHaveValue("Synthetic symptom draft");
});
