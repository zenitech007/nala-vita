import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { completePatientClaim } from "@/lib/patient-claim";
import { trustedRequestIp } from "@/lib/request-ip";
const schema = z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/), email: z.string().trim().email(), password: z.string().min(8).max(128) });
export async function POST(req: NextRequest) {
  try {
    const valid = await completePatientClaim({ ...schema.parse(await req.json()), ip: trustedRequestIp(req) });
    if (!valid) return NextResponse.json({ error: "The code could not be verified. Request a new code or contact your clinic." }, { status: 400 });
    return NextResponse.json({ message: "Your record has been claimed. You can sign in now." });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter your email, six-digit code and a password of at least eight characters" }, { status: 422 });
    return NextResponse.json({ error: "Account setup could not finish. Contact your clinic before retrying." }, { status: 503 });
  }
}
