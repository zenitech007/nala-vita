import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { doctorHasPatientAccess } from "@/lib/access-control";
import { getRecordVisibility } from "@/lib/record-visibility";
import { prisma } from "@/lib/prisma";
import { parsePagination, cursorWhere, pageResult, PaginationError } from "@/lib/pagination";
export async function GET(req:NextRequest) {
 const auth=await requireApiUser({roles:["PATIENT","DOCTOR"]});
 if(!auth.ok) return auth.response;
 try {
  const {limit,cursor}=parsePagination(new URL(req.url).searchParams);
  const scope=auth.user.role==="PATIENT" ? {requesterId:auth.user.id} : {status:"PENDING",prescription:{doctorId:auth.user.doctor!.id}};
  const candidates=await prisma.refillRequest.findMany({where:{AND:[scope,cursorWhere(cursor,"createdAt")]},select:{id:true,createdAt:true,prescription:{select:{patientId:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}],take:limit+1});
  const page=pageResult(candidates,limit,"createdAt");
  const allowed=auth.user.role==="PATIENT" ? page.items : (await Promise.all(page.items.map(async row=>await doctorHasPatientAccess(auth.user.doctor!.id,row.prescription.patientId) ? row : null))).filter(row=>row!==null);
  const policies=auth.user.role==="DOCTOR" ? await Promise.all(allowed.map(async row=>({id:row.id,policy:await getRecordVisibility(auth.user,row.prescription.patientId)}))) : [];
  const requests=await prisma.refillRequest.findMany({where:{AND:[scope,{id:{in:allowed.map(row=>row.id)}},...(auth.user.role==="DOCTOR"?[{OR:policies.map(item=>({id:item.id,prescription:item.policy.where("PRESCRIPTIONS")}))}]:[])]},select:{id:true,status:true,reason:true,createdAt:true,reviewedAt:true,prescription:{select:{id:true,patientId:true,medication:true,authoredByDoctorId:true,authoredByFacilityId:true,authoredByUserId:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}]});
  await Promise.all(policies.map(item=>item.policy.log("PRESCRIPTIONS",requests.filter(row=>row.id===item.id).map(row=>row.prescription))));
  return NextResponse.json({requests,nextCursor:page.nextCursor});
 } catch(error) {
  if(error instanceof PaginationError) return NextResponse.json({error:error.message},{status:400});
  console.error("Refill list failed",error);return NextResponse.json({error:"Unable to load refill requests"},{status:500});
 }
}
