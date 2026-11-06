import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { listConversations, getLatestConversation } from "@/lib/amelia/conversations";

/**
 * GET /api/amelia/conversations          → sidebar list
 * GET /api/amelia/conversations?latest=1 → sidebar list + the conversation to resume
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const conversations = await listConversations(user.patient!.id);

    if (req.nextUrl.searchParams.get("latest") === "1") {
      const latest = await getLatestConversation(user.patient!.id);
      return NextResponse.json({ conversations, latest });
    }

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Amelia conversations GET error:", error);
    return NextResponse.json({ error: "Failed to load conversations." }, { status: 500 });
  }
}
