const getUser=jest.fn(), findUser=jest.fn(), findPatient=jest.fn(), relationship=jest.fn(), analyze=jest.fn();
jest.mock('@/lib/supabase-server',()=>({createServerSupabaseClient:()=>({auth:{getUser}})}));
jest.mock('@/lib/prisma',()=>({prisma:{user:{findUnique:(...a:unknown[])=>findUser(...a)},patient:{findFirst:async()=>null,findUnique:(...a:unknown[])=>findPatient(...a)},appointment:{findFirst:(...a:unknown[])=>relationship(...a)},referral:{findFirst:async()=>null}}}));
jest.mock('@/lib/rate-limit',()=>({checkRateLimitAsync:async()=>({allowed:true})}));
jest.mock('@/lib/amelia/medsafety',()=>({analyzeMedications:(...a:unknown[])=>analyze(...a)}));
import {POST} from '@/app/api/amelia/med-safety/route';
beforeEach(()=>{jest.resetAllMocks();getUser.mockResolvedValue({data:{user:{id:'auth'}}});findPatient.mockResolvedValue({allergies:[],prescriptions:[]});analyze.mockResolvedValue({});});
it.each([
 ['anonymous',null,401],['inactive',{role:'PATIENT',isActive:false,patient:{id:'own'}},403],['other patient',{role:'PATIENT',isActive:true,patient:{id:'own'}},403],['pending doctor',{role:'DOCTOR',isActive:true,doctor:{id:'d',isVerified:false}},403],['unrelated doctor',{role:'DOCTOR',isActive:true,doctor:{id:'d',isVerified:true}},403]
])('F06 denies %s before target data access',async(_label,user,status)=>{findUser.mockResolvedValue(user);if(!user)getUser.mockResolvedValue({data:{user:null}});const res=await POST(new Request('http://localhost/api/amelia/med-safety',{method:'POST',body:JSON.stringify({patientId:'victim'})}) as never);expect(res.status).toBe(status);expect(findPatient).not.toHaveBeenCalled();expect(analyze).not.toHaveBeenCalled();});
it('F06 permits an authorized doctor',async()=>{findUser.mockResolvedValue({id:'u',role:'DOCTOR',isActive:true,doctor:{id:'d',isVerified:true}});relationship.mockResolvedValue({id:'a'});const res=await POST(new Request('http://localhost/api/amelia/med-safety',{method:'POST',body:JSON.stringify({patientId:'victim'})}) as never);expect(res.status).toBe(200);expect(analyze).toHaveBeenCalled();});
