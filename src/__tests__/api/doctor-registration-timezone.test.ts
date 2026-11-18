const create=jest.fn();const createAuth=jest.fn();
jest.mock("@/lib/request-rate-limit",()=>({limitByTrustedIp:async()=>null}));
jest.mock("@/lib/prisma",()=>({prisma:{user:{findUnique:async()=>null,create:(...a:unknown[])=>create(...a)},doctor:{findUnique:async()=>null}}}));
jest.mock("@/lib/supabase-admin",()=>({supabaseAdmin:{auth:{admin:{createUser:(...a:unknown[])=>createAuth(...a),deleteUser:async()=>({error:null})}}}}));
import {POST} from "@/app/api/auth/register/route";
import {NextRequest} from "next/server";
const data={firstName:"Synthetic",lastName:"Doctor",email:"doctor@example.test",password:"Synthetic-password-123!",role:"DOCTOR",licenseNumber:"TEST-123",specialization:"General Practice",yearsOfExperience:3,consultationFee:100,timeZone:"Africa/Lagos"};
beforeEach(()=>{jest.clearAllMocks();createAuth.mockResolvedValue({data:{user:{id:"auth"}},error:null});create.mockResolvedValue({id:"u",doctor:{isVerified:false}});});
test("onboarding stores the chosen IANA zone without verifying doctor",async()=>{
 expect((await POST(new NextRequest("http://localhost/api/auth/register",{method:"POST",body:JSON.stringify(data)}))).status).toBe(201);
 expect(create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({doctor:{create:expect.objectContaining({timeZone:"Africa/Lagos",isVerified:false})}})}));
});
test("invalid onboarding zone is rejected before creating an Auth identity",async()=>{
 expect((await POST(new NextRequest("http://localhost/api/auth/register",{method:"POST",body:JSON.stringify({...data,timeZone:"invalid"})}))).status).toBe(422);expect(createAuth).not.toHaveBeenCalled();
});
