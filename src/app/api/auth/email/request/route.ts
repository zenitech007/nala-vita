import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestEmailVerification } from "@/lib/email-verification";
import { trustedRequestIp } from "@/lib/request-ip";
export async function POST(req: NextRequest) {
  try {
    const { email } = z.object({ email: z.string().trim().email() }).parse(await req.json());
    return NextResponse.json({ ...await requestEmailVerification(email, trustedRequestIp(req)), message: "If eligible, a code will be sent to your email." }, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid email address" }, { status: 422 });
    return NextResponse.json({ error: "Email verification is unavailable. Try later or contact your clinic." }, { status: 503 });
  }
}
