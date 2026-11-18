import {render,screen,fireEvent} from "@testing-library/react";
import AmeliaLauncher from "@/components/amelia/AmeliaLauncher";
const reduced=jest.fn(()=>true);
jest.mock("framer-motion",()=>{
 const React=jest.requireActual<typeof import("react")>("react");
 const element=(tag:string)=>React.forwardRef<HTMLElement,Record<string,unknown>>(function MotionMock({initial,animate,exit,transition,whileHover,whileTap,children,...props},ref){void [animate,exit,transition,whileTap];return React.createElement(tag,{...props,ref,"data-motion-initial":JSON.stringify(initial),"data-motion-hover":JSON.stringify(whileHover)},children as import("react").ReactNode)});
 return {useReducedMotion:()=>reduced(),AnimatePresence:({children}:{children:unknown})=>children,motion:{aside:element("aside"),div:element("div"),button:element("button")}};
});
jest.mock("@/components/amelia/AmeliaChat",()=>({__esModule:true,default:()=> <div>Chat transcript</div>}));
test("reduced motion removes launcher scale and slide transitions",()=>{
 render(<AmeliaLauncher/>);const launcher=screen.getByRole("button",{name:"Ask Amelia AI"});expect(launcher).not.toHaveAttribute("data-motion-hover");
 fireEvent.click(launcher);const transcript=screen.getByText("Chat transcript").parentElement!.parentElement!;
 expect(transcript).toHaveAttribute("data-motion-initial","false");expect(transcript.className).toContain("dvh");
});
