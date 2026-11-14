import { listMessageConversations } from "@/lib/message-conversations";
import { parsePagination, cursorWhere, pageResult, PaginationError } from "@/lib/pagination";
import { chatTopic } from "@/lib/realtime-events";
import { publishPrivateEvent } from "@/lib/realtime-publish";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedMessagingUser,
  getAuthorizedMessageParticipant,
} from "./_access";
import {
  chatAttachmentCategory,
  parseChatAttachmentId,
} from "./attachments/shared";

// ─── GET: Return message thread between two users ────────

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedMessagingUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const otherUserId = searchParams.get("otherUserId");
    const { limit, cursor } = parsePagination(searchParams, 50);
    if (!otherUserId) return NextResponse.json(await listMessageConversations(user, limit, cursor));

    const participant = await getAuthorizedMessageParticipant(user, otherUserId);
    if (!participant) {
      return NextResponse.json(
        { error: "Conversation is not available" },
        { status: 404 }
      );
    }

    // Return thread between current user and otherUserId
    const messages = await prisma.message.findMany({
      where: { AND: [{ OR: [
          { senderId: user.id, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: user.id },
        ] }, cursorWhere(cursor, "createdAt")] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const page = pageResult(messages, limit, "createdAt");
    return NextResponse.json({ messages: page.items.reverse(), nextCursor: page.nextCursor });
  } catch (error) {
    if (error instanceof PaginationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("GET /api/messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST: Send a new message ────────────────────────────

const sendMessageSchema = z.object({
  receiverId: z.string().min(1, "Receiver is required"),
  content: z.string().min(1, "Message cannot be empty"),
  attachmentUrl: z
    .string()
    .refine(
      (value) => parseChatAttachmentId(value) !== null,
      "Attachment reference is invalid"
    )
    .nullable()
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedMessagingUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = sendMessageSchema.parse(body);

    const receiver = await getAuthorizedMessageParticipant(
      user,
      validated.receiverId
    );
    if (!receiver) {
      return NextResponse.json(
        { error: "Conversation is not available" },
        { status: 404 }
      );
    }

    if (validated.attachmentUrl) {
      const attachmentId = parseChatAttachmentId(validated.attachmentUrl)!;
      const attachment = await prisma.fileUpload.findUnique({
        where: { id: attachmentId },
      });

      if (
        !attachment ||
        attachment.userId !== user.id ||
        attachment.category !== chatAttachmentCategory(validated.receiverId)
      ) {
        return NextResponse.json(
          { error: "Attachment is not available" },
          { status: 422 }
        );
      }

      const existingMessage = await prisma.message.findFirst({
        where: { attachmentUrl: validated.attachmentUrl },
        select: { id: true },
      });
      if (existingMessage) {
        return NextResponse.json(
          { error: "Attachment has already been sent" },
          { status: 409 }
        );
      }
    }

    // Create message and notification in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          senderId: user.id,
          receiverId: validated.receiverId,
          content: validated.content,
          attachmentUrl: validated.attachmentUrl || null,
          isRead: false,
        },
      });

      // Create notification for receiver
      await tx.notification.create({
        data: {
          userId: validated.receiverId,
          title: "New Message",
          message: `${user.firstName} ${user.lastName}: ${validated.content.slice(0, 100)}${validated.content.length > 100 ? "..." : ""}`,
          type: "MESSAGE",
          link: user.role === "DOCTOR"
            ? `/patient/chat/${user.id}`
            : `/doctor/chat/${user.id}`,
        },
      });

      return message;
    });

    if (!await publishPrivateEvent(chatTopic(receiver.id), "invalidate", { senderId: user.id, receiverId: receiver.id })) {
      console.warn("Private chat update unavailable");
    }
    return NextResponse.json({ message: result }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    console.error("POST /api/messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── PATCH: Mark messages as read ────────────────────────

const markReadSchema = z.object({
  messageIds: z.array(z.string().min(1).max(128)).min(1).max(100),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedMessagingUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = markReadSchema.parse(body);

    // Only mark messages where the current user is the receiver
    const changed = await prisma.message.updateManyAndReturn({
      where: { id: { in: validated.messageIds }, receiverId: user.id, isRead: false },
      data: { isRead: true },
      select: { senderId: true },
    });
    const recipients = [...new Set(changed.map(message => message.senderId))];
    await Promise.all(recipients.map(async receiverId => {
      if (!await publishPrivateEvent(chatTopic(receiverId), "invalidate", { senderId: user.id, receiverId })) {
        console.warn("Private read receipt update unavailable");
      }
    }));
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    console.error("PATCH /api/messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
