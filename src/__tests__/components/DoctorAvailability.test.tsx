import {render,screen,fireEvent} from "@testing-library/react";
import DoctorSettings from "@/app/(doctor)/doctor/settings/page";
const fetcher=jest.fn();
jest.mock("@/components/settings/SettingsPanel",()=>({__esModule:true,default:()=>null}));
jest.mock("@/lib/api-fetch",()=>({fetchJson:(...a:unknown[])=>fetcher(...a)}));
beforeEach(()=>{jest.clearAllMocks();fetcher.mockResolvedValue({availability:{timeZone:null,availableDays:["Monday"],availableFrom:"09:00",availableTo:"17:00"}});});
test("doctor availability pre-fills browser timezone and retains draft on failure",async()=>{
 render(<DoctorSettings/>);const timezone=await screen.findByLabelText("Doctor availability timezone");expect(timezone).toHaveValue(Intl.DateTimeFormat().resolvedOptions().timeZone);
 fireEvent.change(timezone,{target:{value:"Africa/Lagos"}});fetcher.mockRejectedValueOnce(new Error("Unable to save availability"));fireEvent.click(screen.getByRole("button",{name:"Save availability"}));
 await screen.findByRole("alert");expect(timezone).toHaveValue("Africa/Lagos");expect(screen.queryByText("Availability saved")).not.toBeInTheDocument();
});
