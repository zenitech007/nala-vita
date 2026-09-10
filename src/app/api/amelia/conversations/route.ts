import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { listConversations, getLatestConversation } from "@/lib/amelia/conversations";

/**
 * GET /api/amelia/conversations          → sidebar list
 * GET /api/amelia/conversations?latest=1 → sidebar list + the conversation to resume
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      include: { patient: true },
    });
    if (!user?.patient) return NextResponse.json({ error: "Patient profile not found" }, { status: 404 });

    const conversations = await listConversations(user.patient.id);

    if (req.nextUrl.searchParams.get("latest") === "1") {
      const latest = await getLatestConversation(user.patient.id);
      return NextResponse.json({ conversations, latest });
    }

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Amelia conversations GET error:", error);
    return NextResponse.json({ error: "Failed to load conversations." }, { status: 500 });
  }
}
