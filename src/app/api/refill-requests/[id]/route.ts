import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { doctorHasPatientAccess } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
const decision = z.object({ status: z.enum(["APPROVED", "DENIED"]), reason: z.string().trim().min(3).max(1000) }).strict();
class LostRace extends Error {}
export async function PATCH(req: NextRequest, {params}: {params:Promise<{id:string}>}) {
 const auth = await requireApiUser({roles:["DOCTOR"],profile:"doctor"});
 if (!auth.ok) return auth.response;
 try {
  const body = decision.parse(await req.json());
  const {id}=await params;
  // Only routing metadata is read until target authorization succeeds.
  const request = await prisma.refillRequest.findUnique({where:{id},select:{id:true,requesterId:true,prescription:{select:{doctorId:true,patientId:true}}}});
  if (!request) return NextResponse.json({error:"Request not found"},{status:404});
  if (request.prescription.doctorId !== auth.user.doctor!.id || !await doctorHasPatientAccess(auth.user.doctor!.id,request.prescription.patientId)) return NextResponse.json({error:"Forbidden"},{status:403});
  await prisma.$transaction(async tx=>{
   const result=await tx.refillRequest.updateMany({where:{id,status:"PENDING",prescription:{doctorId:auth.user.doctor!.id}},data:{status:body.status,reason:body.reason,reviewerId:auth.user.id,reviewedAt:new Date()}});
   if(result.count!==1) throw new LostRace();
   await tx.notification.create({data:{userId:request.requesterId,title:"Refill review decision",message:`Your refill request was ${body.status.toLowerCase()}. ${body.reason} Approval is a review decision; dispensing must be confirmed by a pharmacy.`,type:"PRESCRIPTION",link:"/patient/medications"}});
  });
  return NextResponse.json({status:body.status});
 } catch(error) {
  if(error instanceof LostRace) return NextResponse.json({error:"This request has already been reviewed. Refresh the list."},{status:409});
  if(error instanceof z.ZodError) return NextResponse.json({error:"A decision and reason of 3–1000 characters are required"},{status:422});
  console.error("Refill review failed",error);
  return NextResponse.json({error:"Unable to save refill review"},{status:500});
 }
}
