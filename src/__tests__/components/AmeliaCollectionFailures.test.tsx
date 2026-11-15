import {render,screen} from "@testing-library/react";
import AmeliaMemoryPanel from "@/components/amelia/AmeliaMemoryPanel";
import AmeliaRemindersPanel from "@/components/amelia/AmeliaRemindersPanel";
const original=global.fetch;
beforeEach(()=>{Object.defineProperty(globalThis,"fetch",{configurable:true,writable:true,value:jest.fn(async()=>({ok:false,status:503,json:async()=>({error:"Synthetic service unavailable"})}))});});
afterEach(()=>{Object.defineProperty(globalThis,"fetch",{configurable:true,writable:true,value:original});});
test.each([["memory",AmeliaMemoryPanel],["reminders",AmeliaRemindersPanel]] as const)("%s failures are unavailable, not an empty collection",async(_name,Panel)=>{
 render(<Panel/>);expect(await screen.findByRole("alert")).toHaveTextContent("Synthetic service unavailable");
});
