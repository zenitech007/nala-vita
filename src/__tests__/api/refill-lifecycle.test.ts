import { readFileSync } from "node:fs";
const auth=jest.fn();const prescription=jest.fn();const create=jest.fn();const notification=jest.fn();const transaction=jest.fn();
jest.mock("@/lib/auth",()=>({requireApiUser:()=>auth()}));
jest.mock("@/lib/supabase-server",()=>({}));
jest.mock("@/lib/notifications",()=>({createNotification:(...a:unknown[])=>notification(...a)}));
jest.mock("@/lib/prisma",()=>({prisma:{prescription:{findFirst:(...a:unknown[])=>prescription(...a)},$transaction:(fn:(tx:unknown)=>unknown)=>transaction(fn)}}));
import {PATCH} from "@/app/api/medications/[id]/refill/route";
import {NextRequest} from "next/server";
const ctx={params:Promise.resolve({id:"rx"})};
beforeEach(()=>{jest.clearAllMocks();auth.mockResolvedValue({ok:true,user:{id:"u",role:"PATIENT",firstName:"Test",lastName:"Patient",patient:{id:"p"}}});prescription.mockResolvedValue({id:"rx",patientId:"p",medication:"Synthetic",isActive:true,refillsUsed:0,refillsAllowed:1,doctor:{user:{id:"du"}}});transaction.mockImplementation(async fn=>fn({refillRequest:{create},notification:{create:notification}}));create.mockResolvedValue({id:"r",status:"PENDING"});});
test("request is persisted with a notification atomically",async()=>{
 const response=await PATCH(new NextRequest("http://localhost/api/medications/rx/refill",{method:"PATCH"}),ctx);
 expect(response.status).toBe(200);expect(create).toHaveBeenCalledWith({data:{prescriptionId:"rx",requesterId:"u"}});
 expect(notification).toHaveBeenCalledTimes(1);expect(await response.json()).toMatchObject({request:{id:"r",status:"PENDING"}});
});
test("pending duplicate returns conflict",async()=>{
 create.mockRejectedValue({code:"P2002"});expect((await PATCH(new NextRequest("http://localhost/api/medications/rx/refill",{method:"PATCH"}),ctx)).status).toBe(409);
});
test("no remaining refills cannot create request",async()=>{
 prescription.mockResolvedValue({patientId:"p",refillsAllowed:0,refillsUsed:0,doctor:{user:{id:"du"}}});
 expect((await PATCH(new NextRequest("http://localhost/api/medications/rx/refill",{method:"PATCH"}),ctx)).status).toBe(400);expect(transaction).not.toHaveBeenCalled();
});

test("private migration enforces one pending request per prescription",()=>{
 const sql=readFileSync("prisma/migrations/20261113000000_refill_requests/migration.sql","utf8");
 expect(sql).toMatch(/CREATE UNIQUE INDEX[^;]+prescription_id\) WHERE status = 'PENDING'/);
 expect(sql).toContain("'APPROVED','DENIED'");expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
});
