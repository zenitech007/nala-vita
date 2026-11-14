import {preferredScrollBehavior} from "@/lib/motion-preferences";
test.each([[true,"auto"],[false,"smooth"]])("scroll honors current reduced-motion preference %s",(matches,expected)=>{
 Object.defineProperty(window,"matchMedia",{configurable:true,value:jest.fn(()=>({matches}))});expect(preferredScrollBehavior()).toBe(expected);
});
