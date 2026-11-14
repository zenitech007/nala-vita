const auth=jest.fn();const find=jest.fn();const access=jest.fn();const conditional=jest.fn();const notify=jest.fn();
jest.mock("@/lib/auth",()=>({requireApiUser:()=>auth()}));
jest.mock("@/lib/access-control",()=>({doctorHasPatientAccess:(...a:unknown[])=>access(...a)}));
jest.mock("@/lib/prisma",()=>({prisma:{refillRequest:{findUnique:(...a:unknown[])=>find(...a)},$transaction:async(fn:(tx:unknown)=>unknown)=>fn({refillRequest:{updateMany:conditional},notification:{create:notify}})}}));
import {PATCH} from "@/app/api/refill-requests/[id]/route";
import {NextRequest,NextResponse} from "next/server";
const ctx={params:Promise.resolve({id:"r"})};
const request=(status="APPROVED")=>new NextRequest("http://localhost/api/refill-requests/r",{method:"PATCH",body:JSON.stringify({status,reason:"Reviewed request"})});
beforeEach(()=>{jest.clearAllMocks();auth.mockResolvedValue({ok:true,user:{id:"du",role:"DOCTOR",doctor:{id:"d"}}});find.mockResolvedValue({id:"r",requesterId:"u",status:"PENDING",prescription:{doctorId:"d",patientId:"p"}});access.mockResolvedValue(true);conditional.mockResolvedValue({count:1});});
test.each(["APPROVED","DENIED"])("prescriber can decide %s and notify patient",async status=>{
 expect((await PATCH(request(status),ctx)).status).toBe(200);
 expect(conditional).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id:"r",status:"PENDING"}),data:expect.objectContaining({status,reviewerId:"du"})}));
 expect(notify).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({userId:"u"})}));
});
test("lost race is conflict with no notification",async()=>{conditional.mockResolvedValue({count:0});expect((await PATCH(request(),ctx)).status).toBe(409);expect(notify).not.toHaveBeenCalled();});
test("unrelated doctor cannot review",async()=>{find.mockResolvedValue({prescription:{doctorId:"another",patientId:"p"}});expect((await PATCH(request(),ctx)).status).toBe(403);expect(conditional).not.toHaveBeenCalled();});
test("target care access required",async()=>{access.mockResolvedValue(false);expect((await PATCH(request(),ctx)).status).toBe(403);expect(conditional).not.toHaveBeenCalled();});
test("patient role rejected",async()=>{auth.mockResolvedValue({ok:false,response:NextResponse.json({error:"Forbidden"},{status:403})});expect((await PATCH(request(),ctx)).status).toBe(403);expect(find).not.toHaveBeenCalled();});
