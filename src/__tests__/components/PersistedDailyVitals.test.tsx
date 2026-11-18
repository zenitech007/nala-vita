import {render,screen,fireEvent,waitFor,act} from "@testing-library/react";
import PersistedDailyVitals from "@/components/dashboard/PersistedDailyVitals";
const fetcher=jest.fn();
jest.mock("@/lib/api-fetch",()=>({fetchJson:(...a:unknown[])=>fetcher(...a)}));
jest.mock("@/lib/daily-vitals",()=>({browserVitalDay:()=>({day:"2026-11-13",timeZone:"America/Phoenix"})}));
test("loads the saved snapshot and serializes rapid edits through the vitals API",async()=>{
 let release:()=>void=()=>{};
 const firstSave=new Promise<void>(resolve=>{release=resolve;});
 fetcher.mockResolvedValueOnce({dailyVitals:{waterLiters:1,steps:23,medsTaken:false}}).mockReturnValueOnce(firstSave).mockResolvedValueOnce({});
 render(<PersistedDailyVitals/>);const add=await screen.findByRole("button",{name:/add 250ml/i});expect(screen.getByRole("spinbutton",{name:"Daily steps"})).toHaveValue(23);
 fireEvent.click(add);fireEvent.click(add);
 await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
 await act(async()=>{release();await firstSave;});
 await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(3));
 const options=fetcher.mock.calls[2][1];expect(fetcher.mock.calls[2][0]).toBe("/api/vitals");expect(JSON.parse(options.body)).toEqual({dailyVitals:{day:"2026-11-13",timeZone:"America/Phoenix",waterLiters:1.5,steps:23,medsTaken:false}});
 await screen.findByText("Daily vitals saved");
});
