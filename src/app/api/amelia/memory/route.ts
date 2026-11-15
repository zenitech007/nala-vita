import { requireApiUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { listMemories } from "@/lib/amelia/memory";

export async function GET() {
  const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const memories = await listMemories(user.patient!.id);
  return NextResponse.json({ memories });
}
