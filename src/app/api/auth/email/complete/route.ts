import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { completeEmailVerification } from "@/lib/email-verification";
import { trustedRequestIp } from "@/lib/request-ip";
export async function POST(req: NextRequest) {
  try {
    const input = z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/), email: z.string().trim().email() }).parse(await req.json());
    if (!await completeEmailVerification({ ...input, ip: trustedRequestIp(req) }))
      return NextResponse.json({ error: "The code could not be verified. Request a new code." }, { status: 400 });
    return NextResponse.json({ message: "Email verified. You can sign in now." });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter your email and six-digit code" }, { status: 422 });
    return NextResponse.json({ error: "Email confirmation could not finish. Try later or contact your clinic." }, { status: 503 });
  }
}
