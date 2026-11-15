import {jest} from "@jest/globals";
import {render,screen,fireEvent,act} from "@testing-library/react";
import {CommandPalette} from "@/components/ui/CommandPalette";
jest.mock("next/navigation",()=>({useRouter:()=>({push:jest.fn()})}));
type Result={id:string;title:string;category:string;href:string};
type SearchResponse={ok:boolean;json:()=>Promise<{results:Result[]}>};
const originalFetch=global.fetch;
const fetcher=jest.fn<(...args:unknown[])=>Promise<SearchResponse>>();
beforeEach(()=>{jest.useFakeTimers();fetcher.mockReset();Object.defineProperty(globalThis,"fetch",{configurable:true,writable:true,value:fetcher});});
afterEach(()=>{jest.useRealTimers();Object.defineProperty(globalThis,"fetch",{configurable:true,writable:true,value:originalFetch});});
test("stale remote results cannot replace the current query",async()=>{
 let resolveOld:(response:SearchResponse)=>void=()=>{};
 fetcher.mockReturnValueOnce(new Promise(resolve=>{resolveOld=resolve;})).mockResolvedValueOnce({ok:true,json:async()=>({results:[{id:"new",title:"New search result",category:"patients",href:"/doctor/patients/new"}]})});
 render(<CommandPalette role="doctor" isOpen onClose={()=>{}}/>);const input=screen.getByRole("textbox");
 fireEvent.change(input,{target:{value:"old"}});await act(async()=>{jest.advanceTimersByTime(200);});
 fireEvent.change(input,{target:{value:"new"}});await act(async()=>{jest.advanceTimersByTime(200);});
 expect(screen.getByText("New search result")).toBeInTheDocument();
 await act(async()=>{resolveOld({ok:true,json:async()=>({results:[{id:"old",title:"Old search result",category:"patients",href:"/doctor/patients/old"}]})});});
 expect(screen.queryByText("Old search result")).not.toBeInTheDocument();
 fireEvent.change(input,{target:{value:""}});expect(screen.queryByText("New search result")).not.toBeInTheDocument();
});
test("reopening starts with a fresh query",()=>{
 const props={role:"doctor" as const,onClose:()=>{}};const view=render(<CommandPalette {...props} isOpen/>);
 fireEvent.change(screen.getByRole("textbox"),{target:{value:"typed draft"}});view.rerender(<CommandPalette {...props} isOpen={false}/>);view.rerender(<CommandPalette {...props} isOpen/>);
 expect(screen.getByRole("textbox")).toHaveValue("");
});
