import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestPatientClaim } from "@/lib/patient-claim";
import { trustedRequestIp } from "@/lib/request-ip";
const schema = z.object({ email: z.string().trim().email(), invitationCode: z.string().max(128).optional() });
export async function POST(req: NextRequest) {
  try {
    const input = schema.parse(await req.json());
    const result = await requestPatientClaim(input.email, trustedRequestIp(req), input.invitationCode);
    return NextResponse.json({ ...result, message: "If eligible, a verification code will be sent. Check your email or contact your clinic." }, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid email address" }, { status: 422 });
    return NextResponse.json({ error: "Verification is unavailable. Contact your clinic or try later." }, { status: 503 });
  }
}
