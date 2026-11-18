const auth = jest.fn();
const notifications = jest.fn();
const payments = jest.fn();
jest.mock("@/lib/auth",()=>({requireApiUser:()=>auth()}));
jest.mock("@/lib/prisma",()=>({prisma:{notification:{findMany:(...args:unknown[])=>notifications(...args),count:async()=>0},payment:{findMany:(...args:unknown[])=>payments(...args)}}}));
jest.mock("@/lib/payment-checkout",()=>({}));
import {GET as notificationGET} from "@/app/api/notifications/route";
import {GET as paymentGET} from "@/app/api/payments/route";
import {NextRequest} from "next/server";
beforeEach(()=>{jest.clearAllMocks();auth.mockResolvedValue({ok:true,user:{id:"u",role:"PATIENT",patient:{id:"p"}}});notifications.mockResolvedValue([]);payments.mockResolvedValue([]);});
test.each([["notifications",notificationGET,notifications],["payments",paymentGET,payments]] as const)("%s is bounded and has a stable cursor",async(path,get,find)=>{
 const res=await get(new NextRequest(`http://localhost/api/${path}?limit=999999`));
 expect(res.status).toBe(200);
 expect(find).toHaveBeenCalledWith(expect.objectContaining({take:101,orderBy:[{createdAt:"desc"},{id:"desc"}]}));
 expect(await res.json()).toHaveProperty("nextCursor",null);
});
test("bad cursor is rejected before accessing data",async()=>{
 const res=await notificationGET(new NextRequest("http://localhost/api/notifications?cursor=forged"));
 expect(res.status).toBe(400);expect(notifications).not.toHaveBeenCalled();
});
