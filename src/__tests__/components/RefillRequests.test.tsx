import {render,screen,fireEvent} from "@testing-library/react";
import RefillRequests from "@/components/medications/RefillRequests";
const fetcher=jest.fn();
jest.mock("@/lib/api-fetch",()=>({fetchJson:(...a:unknown[])=>fetcher(...a)}));
beforeEach(()=>{jest.clearAllMocks();fetcher.mockResolvedValue({requests:[{id:"r",status:"PENDING",reason:null,prescription:{medication:"Synthetic medication",patientId:"synthetic-patient"}}],nextCursor:null});});
test("review requires a reason and keeps it when saving fails",async()=>{
 render(<RefillRequests review/>);await screen.findByText("Synthetic medication");
 expect(screen.getByRole("link",{name:"Open patient record"})).toHaveAttribute("href","/doctor/patients/synthetic-patient");
 expect(screen.getByRole("button",{name:"Approve review"})).toBeDisabled();
 const field=screen.getByLabelText("Review reason");fireEvent.change(field,{target:{value:"Reviewed eligibility"}});
 fetcher.mockRejectedValueOnce(new Error("Already reviewed. Refresh the list."));fireEvent.click(screen.getByRole("button",{name:"Approve review"}));
 await screen.findByRole("alert");expect(field).toHaveValue("Reviewed eligibility");
 expect(screen.queryByText("Review saved. The patient has been notified.")).not.toBeInTheDocument();
});
test("patients see durable decisions without clinician controls",async()=>{
 fetcher.mockResolvedValue({requests:[{id:"r",status:"DENIED",reason:"Needs a consultation",prescription:{medication:"Synthetic medication"}}],nextCursor:null});
 render(<RefillRequests/>);await screen.findByText("Needs a consultation");expect(screen.queryByRole("button",{name:"Approve review"})).not.toBeInTheDocument();
});
