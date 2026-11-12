import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR", "ADMIN"], allowUnverifiedDoctor: true });
  if (!auth.ok) return auth.response;
  return NextResponse.json({ user: { id: auth.user.id, role: auth.user.role }, authUserId: auth.authUserId }, {
    headers: { "Cache-Control": "no-store" },
  });
}
