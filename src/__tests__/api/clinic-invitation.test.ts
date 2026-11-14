const guard=jest.fn();const count=jest.fn();const find=jest.fn();const create=jest.fn();const expire=jest.fn();
jest.mock("@/lib/auth",()=>({requireApiUser:(...a:unknown[])=>guard(...a)}));
jest.mock("@/lib/email-otp",()=>({otpDigest:(input:string)=>"hashed:"+input}));
jest.mock("@/lib/prisma",()=>({prisma:{patient:{count:(...a:unknown[])=>count(...a),findFirst:(...a:unknown[])=>find(...a)},$transaction:async(fn:(tx:unknown)=>unknown)=>fn({claimInvitation:{create,updateMany:expire}})}}));
import {GET,POST} from "@/app/api/patients/[id]/invitation/route";
import {NextRequest} from "next/server";
const ctx={params:Promise.resolve({id:"p"})};const req=new NextRequest("http://localhost/api/patients/p/invitation");
beforeEach(()=>{jest.clearAllMocks();guard.mockResolvedValue({ok:true,user:{id:"du",doctor:{id:"d"}}});count.mockResolvedValue(1);find.mockResolvedValue({id:"p"});});
test("eligibility checks only active unbound records created by authenticated doctor",async()=>{
 const response=await GET(req,ctx);expect(await response.json()).toEqual({eligible:true});expect(count).toHaveBeenCalledWith({where:{id:"p",createdByDoctorId:"d",user:{supabaseId:null,isActive:true}}});
 expect(guard).toHaveBeenCalledWith({roles:["DOCTOR"],profile:"doctor"});expect(response.headers.get("cache-control")).toContain("no-store");
});
test("issuance returns a code privately and stores only its digest",async()=>{
 const response=await POST(req,ctx);expect(response.status).toBe(201);const body=await response.json();expect(body.invitationCode).toMatch(/^[0-9a-f]{64}$/);
 expect(create).toHaveBeenCalledWith({data:expect.objectContaining({patientId:"p",issuerDoctorId:"d",tokenHash:"hashed:invite:"+body.invitationCode})});expect(expire).toHaveBeenCalledTimes(1);expect(response.headers.get("cache-control")).toContain("no-store");
});
test("bound or other-creator record cannot receive a code",async()=>{find.mockResolvedValue(null);expect((await POST(req,ctx)).status).toBe(404);expect(create).not.toHaveBeenCalled();});
