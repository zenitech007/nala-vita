import { BodyReadError, readBoundedJson } from "@/lib/bounded-body";
import { imageDataUrlSchema, MAX_IMAGE_DATA_URL } from "@/lib/image-data-url";
import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { runAmeliaTurn, runAmeliaTurnStream } from "@/lib/amelia/engine";
import { extractMemories, saveMemories } from "@/lib/amelia/memory";
import { detectReminder, computeNextFireAt, describeSchedule } from "@/lib/amelia/reminders";
import { logAudit } from "@/lib/audit";
import { extractLabsFromImage } from "@/lib/amelia/labvision";

const bodySchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(4000),
  imageDataUrl: imageDataUrlSchema.optional(),
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
    const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const limit = await checkRateLimitAsync(`amelia:chat:${user.id}`, { maxRequests: 20, windowMs: 60_000 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { conversationId, message, imageDataUrl, stream } = bodySchema.parse(await readBoundedJson(req, MAX_IMAGE_DATA_URL + 32_768));
    const patientId = user.patient!.id;

    let convo = conversationId
      ? await prisma.ameliaConversation.findFirst({ where: { id: conversationId, patientId } })
      : null;
    if (!convo) {
      convo = await prisma.ameliaConversation.create({ data: { patientId, audience: "patient" } });
    }
    const convoId = convo.id;

    let imageStatus: "available" | "unavailable" | undefined;
    let effectiveMessage = message;
    if (imageDataUrl) {
      try {
        const labResult = await extractLabsFromImage(imageDataUrl);
        imageStatus = labResult.status ?? (labResult.results.length ? "available" : "unavailable");
        if (imageStatus !== "unavailable" && labResult.results.length > 0) {
          const labDetails = labResult.results
            .map((r) => `- ${r.name}: ${r.value} ${r.unit || ""} (Ref: ${r.referenceRange || "—"}, Flag: ${r.flag})`)
            .join("\n");
          effectiveMessage = `${message}\n\n[Attached Lab Report Image Read by Amelia]:\n${labDetails}\nSummary: ${labResult.summary}`;
        } else if (labResult.summary) {
          effectiveMessage = `${message}\n\n[Attached Image Note]: ${labResult.summary}`;
        }
      } catch (imgErr) {
        imageStatus = "unavailable";
        effectiveMessage = `${message}\n\n[Attached image unavailable: no lab values could be read. Do not infer findings.]`;
        console.warn("Lab vision processing error:", imgErr);
      }
    }

    const userMsg = await prisma.ameliaMessage.create({
      data: { conversationId: convoId, role: "user", content: effectiveMessage },
    });

    const history = await prisma.ameliaMessage.findMany({
      where: { conversationId: convoId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const messages = history.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // `updatedAt` is @updatedAt, so it only moves when the conversation row itself
    // is written. Message inserts don't touch it — bump it explicitly to keep the
    // sidebar ordered by real activity.
    const touchConversation = () =>
      prisma.ameliaConversation.update({ where: { id: convoId }, data: { updatedAt: new Date() } });

    // ---- Buffered path (explicit opt-out, and the shape the tests assert) ----
    if (stream === false) {
      const reply = await runAmeliaTurn({ audience: "patient", patientId, viewer: user, messages, rawMessage: message });

      await prisma.ameliaMessage.create({
        data: { conversationId: convoId, role: "assistant", content: reply.content },
      });
      await touchConversation();

      const reminderSuggestion = await runPostTurn(patientId, userMsg.id, message, reply.content);

      await logAudit({
        userId: user.id,
        action: "amelia.chat",
        resourceType: "AMELIA_CONVERSATION", resourceId: convoId,
        metadata: { urgency: reply.urgency, redFlagCount: reply.redFlags.length },
      });

      return NextResponse.json({ conversationId: convoId, reply, reminderSuggestion, imageStatus });
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
          send({ type: "meta", conversationId: convoId, imageStatus });

          for await (const evt of runAmeliaTurnStream({ audience: "patient", patientId, viewer: user, messages, rawMessage: message })) {
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

          await logAudit({
            userId: user.id,
            action: "amelia.chat",
            resourceType: "AMELIA_CONVERSATION", resourceId: convoId,
            metadata: { urgency, redFlagCount, streamed: true },
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
    if (error instanceof BodyReadError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    console.error("Amelia chat error:", error);
    return NextResponse.json({ error: "Amelia is unavailable right now." }, { status: 500 });
  }
}
