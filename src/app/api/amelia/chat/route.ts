import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { runAmeliaTurn } from "@/lib/amelia/engine";
import { extractMemories, saveMemories } from "@/lib/amelia/memory";
import { logAmeliaAudit } from "@/lib/amelia/audit";

const bodySchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { supabaseId: authUser.id }, include: { patient: true } });
    if (!user?.patient) return NextResponse.json({ error: "Patient profile not found" }, { status: 404 });

    const limit = await checkRateLimitAsync(`amelia:chat:${user.id}`, { maxRequests: 20, windowMs: 60_000 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { conversationId, message } = bodySchema.parse(await req.json());

    let convo = conversationId
      ? await prisma.ameliaConversation.findFirst({ where: { id: conversationId, patientId: user.patient.id } })
      : null;
    if (!convo) {
      convo = await prisma.ameliaConversation.create({ data: { patientId: user.patient.id, audience: "patient" } });
    }

    const userMsg = await prisma.ameliaMessage.create({ data: { conversationId: convo.id, role: "user", content: message } });

    const history = await prisma.ameliaMessage.findMany({
      where: { conversationId: convo.id },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const reply = await runAmeliaTurn({
      audience: "patient",
      patientId: user.patient.id,
      messages: history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    await prisma.ameliaMessage.create({ data: { conversationId: convo.id, role: "assistant", content: reply.content } });

    // Phase 2: extract + persist durable memories from this exchange (best-effort;
    // never let memory failure break the chat response).
    try {
      const candidates = await extractMemories(message, reply.content);
      await saveMemories(user.patient.id, candidates, userMsg.id);
    } catch (memErr) {
      console.error("Amelia memory extraction failed:", memErr);
    }

    await logAmeliaAudit({
      userId: user.id,
      action: "amelia.chat",
      conversationId: convo.id,
      summary: `urgency=${reply.urgency} redFlags=${reply.redFlags.length}`,
    });

    return NextResponse.json({ conversationId: convo.id, reply });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    console.error("Amelia chat error:", error);
    return NextResponse.json({ error: "Amelia is unavailable right now." }, { status: 500 });
  }
}
