import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { RECORD_SCOPES } from "@/lib/record-scope";
import { createPatientRecordRequest } from "@/lib/record-access-requests";
import { consentApiError } from "@/lib/consent-api";
const schema = z.object({ doctorId: z.string().min(1), sourceDoctorId: z.string().min(1).optional(),
  reason: z.string().trim().max(1000).optional(),
  sourceFacilityId: z.string().min(1).optional(), sourceUserId: z.string().min(1).optional(),
  scope: z.array(z.enum(RECORD_SCOPES)).min(1).default([...RECORD_SCOPES]) });
export async function POST(req: NextRequest) {
  const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
  if (!auth.ok) return auth.response;
  try {
    const request = await createPatientRecordRequest(auth.user, schema.parse(await req.json()));
    return NextResponse.json({ request, message: "Sharing request prepared. Open Who has access, choose the scope and duration, then verify your email code to approve." }, { status: 202 });
  } catch (error) { return consentApiError(error); }
}
