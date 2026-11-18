import {jest} from "@jest/globals";
import {act,fireEvent,render,screen} from "@testing-library/react";
import RouteProgress from "@/components/common/RouteProgress";
let pathname="/";
jest.mock("next/navigation",()=>({usePathname:()=>pathname,useSearchParams:()=>new URLSearchParams()}));
beforeEach(()=>{jest.useFakeTimers();pathname="/";window.history.replaceState(null,"","/");});
afterEach(()=>jest.useRealTimers());
test("completed navigation stays dismissed after pending animation timers run",()=>{
 const view=render(<><a href="/patient">Open patient</a><RouteProgress/></>);
 fireEvent.click(screen.getByText("Open patient"));
 expect(screen.getByRole("progressbar",{hidden:true})).toBeInTheDocument();
 pathname="/patient";
 view.rerender(<><a href="/patient">Open patient</a><RouteProgress/></>);
 act(()=>jest.advanceTimersByTime(250));
 expect(screen.queryByRole("progressbar",{hidden:true})).toBeNull();
 act(()=>jest.advanceTimersByTime(100));
 expect(screen.queryByRole("progressbar",{hidden:true})).toBeNull();
});
