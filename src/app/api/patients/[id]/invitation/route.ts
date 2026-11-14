import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { otpDigest } from "@/lib/email-otp";
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser({ roles: ["DOCTOR"], profile: "doctor" });
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const patient = await prisma.patient.findFirst({ where: { id, createdByDoctorId: auth.user.doctor!.id, user: { supabaseId: null, isActive: true } } });
    if (!patient) return NextResponse.json({ error: "Unbound clinic record not found" }, { status: 404 });
    const invitationCode = randomBytes(32).toString("hex"), expiresAt = new Date(Date.now() + 86400000);
    await prisma.$transaction(async tx => {
      await tx.claimInvitation.updateMany({ where: { patientId: id, usedAt: null }, data: { usedAt: new Date() } });
      await tx.claimInvitation.create({ data: { patientId: id, issuerDoctorId: auth.user.doctor!.id,
        tokenHash: otpDigest(`invite:${invitationCode}`), expiresAt } });
    });
    return NextResponse.json({ invitationCode, expiresAt, message: "Give this single-use code privately to the patient. It expires in 24 hours. The patient must also verify their chosen email." }, { status: 201, headers:{"Cache-Control":"private, no-store"} });
  } catch { return NextResponse.json({ error: "Could not issue a clinic invitation" }, { status: 503 }); }
}

export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const auth=await requireApiUser({roles:["DOCTOR"],profile:"doctor"});if(!auth.ok)return auth.response;
 try{
  const {id}=await params;
  const eligible=await prisma.patient.count({where:{id,createdByDoctorId:auth.user.doctor!.id,user:{supabaseId:null,isActive:true}}});
  return NextResponse.json({eligible:eligible>0},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"Could not check invitation eligibility"},{status:503});}
}
