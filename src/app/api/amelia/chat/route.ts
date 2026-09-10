import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { runAmeliaTurn, runAmeliaTurnStream } from "@/lib/amelia/engine";
import { extractMemories, saveMemories } from "@/lib/amelia/memory";
import { detectReminder, computeNextFireAt, describeSchedule } from "@/lib/amelia/reminders";
import { logAmeliaAudit } from "@/lib/amelia/audit";

const bodySchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(4000),
  /** When false the client gets a single JSON body instead of an SSE stream. */
  stream: z.boolean().optional(),
});

interface ReminderSuggestion {
  kind: string;
  label: string;
  frequency: string;
  nextFireAt: string;
  schedule: string;
}

/**
 * Post-turn side effects: durable memory extraction and reminder detection.
 * Best-effort — a failure here must never corrupt or fail the reply the patient
 * already received.
 */
async function runPostTurn(
  patientId: string,
  userMessageId: string,
  message: string,
  replyContent: string
): Promise<ReminderSuggestion | null> {
  try {
    const candidates = await extractMemories(message, replyContent);
    await saveMemories(patientId, candidates, userMessageId);
  } catch (memErr) {
    console.error("Amelia memory extraction failed:", memErr);
  }

  try {
    const candidate = await detectReminder(message, replyContent);
    if (candidate) {
      const nextFireAt = computeNextFireAt(candidate, new Date());
      return {
        kind: candidate.kind,
        label: candidate.label,
        frequency: candidate.frequency,
        nextFireAt: nextFireAt.toISOString(),
        schedule: describeSchedule(candidate.frequency, nextFireAt),
      };
    }
  } catch (remErr) {
    console.error("Amelia reminder detection failed:", remErr);
  }

  return null;
}

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

    const { conversationId, message, stream } = bodySchema.parse(await req.json());
    const patientId = user.patient.id;

    let convo = conversationId
      ? await prisma.ameliaConversation.findFirst({ where: { id: conversationId, patientId } })
      : null;
    if (!convo) {
      convo = await prisma.ameliaConversation.create({ data: { patientId, audience: "patient" } });
    }
    const convoId = convo.id;

    const userMsg = await prisma.ameliaMessage.create({
      data: { conversationId: convoId, role: "user", content: message },
    });

    const history = await prisma.ameliaMessage.findMany({
      where: { conversationId: convoId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    const messages = history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // `updatedAt` is @updatedAt, so it only moves when the conversation row itself
    // is written. Message inserts don't touch it — bump it explicitly to keep the
    // sidebar ordered by real activity.
    const touchConversation = () =>
      prisma.ameliaConversation.update({ where: { id: convoId }, data: { updatedAt: new Date() } });

    // ---- Buffered path (explicit opt-out, and the shape the tests assert) ----
    if (stream === false) {
      const reply = await runAmeliaTurn({ audience: "patient", patientId, messages });

      await prisma.ameliaMessage.create({
        data: { conversationId: convoId, role: "assistant", content: reply.content },
      });
      await touchConversation();

      const reminderSuggestion = await runPostTurn(patientId, userMsg.id, message, reply.content);

      await logAmeliaAudit({
        userId: user.id,
        action: "amelia.chat",
        conversationId: convoId,
        summary: `urgency=${reply.urgency} redFlags=${reply.redFlags.length}`,
      });

      return NextResponse.json({ conversationId: convoId, reply, reminderSuggestion });
    }

    // ---- Streaming path (default) ----
    const encoder = new TextEncoder();
    const sse = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

        let full = "";
        let urgency = "routine";
        let redFlagCount = 0;

        try {
          send({ type: "meta", conversationId: convoId });

          for await (const evt of runAmeliaTurnStream({ audience: "patient", patientId, messages })) {
            if (evt.type === "start") {
              urgency = evt.meta.urgency;
              redFlagCount = evt.meta.redFlags.length;
              send({
                type: "start",
                urgency: evt.meta.urgency,
                redFlags: evt.meta.redFlags,
                disclaimer: evt.meta.disclaimer,
              });
            } else {
              full += evt.text;
              send({ type: "delta", text: evt.text });
            }
          }

          // Persist the completed reply before announcing done, so a reload right
          // after the stream ends always finds the message.
          await prisma.ameliaMessage.create({
            data: { conversationId: convoId, role: "assistant", content: full },
          });
          await touchConversation();

          const reminderSuggestion = await runPostTurn(patientId, userMsg.id, message, full);

          await logAmeliaAudit({
            userId: user.id,
            action: "amelia.chat",
            conversationId: convoId,
            summary: `urgency=${urgency} redFlags=${redFlagCount} streamed=1`,
          });

          send({ type: "done", conversationId: convoId, reminderSuggestion });
        } catch (streamErr) {
          console.error("Amelia stream error:", streamErr);
          // Save whatever arrived so the turn isn't silently lost.
          if (full) {
            try {
              await prisma.ameliaMessage.create({
                data: { conversationId: convoId, role: "assistant", content: full },
              });
              await touchConversation();
            } catch (saveErr) {
              console.error("Amelia partial-reply save failed:", saveErr);
            }
          }
          send({ type: "error", error: "Amelia was interrupted. Please try again." });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(sse, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    console.error("Amelia chat error:", error);
    return NextResponse.json({ error: "Amelia is unavailable right now." }, { status: 500 });
  }
}
