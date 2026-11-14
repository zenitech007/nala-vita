jest.mock("next-intl",()=>({useLocale:()=>"en"}));
import {render,screen,fireEvent} from "@testing-library/react";
import ClinicInvitation from "@/components/patients/ClinicInvitation";
const fetcher=jest.fn();
jest.mock("@/lib/api-fetch",()=>({fetchJson:(...a:unknown[])=>fetcher(...a)}));
beforeEach(()=>{jest.clearAllMocks();fetcher.mockResolvedValueOnce({eligible:true});});
test("issues a code only after clinician action and displays private sharing instructions",async()=>{
 render(<ClinicInvitation patientId="synthetic"/>);const issue=await screen.findByRole("button",{name:"Issue clinic invitation"});expect(fetcher).toHaveBeenCalledTimes(1);
 fetcher.mockResolvedValueOnce({invitationCode:"synthetic-single-use-code",expiresAt:"2026-11-15T12:00:00Z"});fireEvent.click(issue);
 expect(await screen.findByLabelText("Single-use invitation code")).toHaveValue("synthetic-single-use-code");expect(screen.getByText(/Share this code privately/)).toBeInTheDocument();expect(screen.queryByText(/email sent/i)).not.toBeInTheDocument();
});
test("failed issuance shows no code or saved claim",async()=>{
 render(<ClinicInvitation patientId="synthetic"/>);const issue=await screen.findByRole("button",{name:"Issue clinic invitation"});fetcher.mockRejectedValueOnce(new Error("Could not issue a clinic invitation"));fireEvent.click(issue);
 await screen.findByRole("alert");expect(screen.queryByLabelText("Single-use invitation code")).not.toBeInTheDocument();
});
