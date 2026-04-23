import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// ─── GET: Return message thread between two users ────────

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const otherUserId = searchParams.get("otherUserId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!otherUserId) {
      // Return conversation list (unique partners)
      const sentTo = await prisma.message.findMany({
        where: { senderId: user.id },
        select: { receiverId: true },
        distinct: ["receiverId"],
      });

      const receivedFrom = await prisma.message.findMany({
        where: { receiverId: user.id },
        select: { senderId: true },
        distinct: ["senderId"],
      });

      const partnerIds = Array.from(
        new Set([
          ...sentTo.map((m) => m.receiverId),
          ...receivedFrom.map((m) => m.senderId),
        ])
      );

      const conversations = await Promise.all(
        partnerIds.map(async (partnerId) => {
          const partner = await prisma.user.findUnique({
            where: { id: partnerId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              role: true,
            },
          });

          const lastMessage = await prisma.message.findFirst({
            where: {
              OR: [
                { senderId: user.id, receiverId: partnerId },
                { senderId: partnerId, receiverId: user.id },
              ],
            },
            orderBy: { createdAt: "desc" },
          });

          const unreadCount = await prisma.message.count({
            where: {
              senderId: partnerId,
              receiverId: user.id,
              isRead: false,
            },
          });

          return { partner, lastMessage, unreadCount };
        })
      );

      // Sort by last message time
      conversations.sort((a, b) => {
        const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return tb - ta;
      });

      return NextResponse.json({ conversations });
    }

    // Return thread between current user and otherUserId
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: user.id, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: user.id },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("GET /api/messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST: Send a new message ────────────────────────────

const sendMessageSchema = z.object({
  receiverId: z.string().min(1, "Receiver is required"),
  content: z.string().min(1, "Message cannot be empty"),
  attachmentUrl: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const validated = sendMessageSchema.parse(body);

    // Verify receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: validated.receiverId },
    });

    if (!receiver) {
      return NextResponse.json({ error: "Receiver not found" }, { status: 404 });
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
  messageIds: z.array(z.string()).min(1),
});

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const validated = markReadSchema.parse(body);

    // Only mark messages where the current user is the receiver
    await prisma.message.updateMany({
      where: {
        id: { in: validated.messageIds },
        receiverId: user.id,
      },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    console.error("PATCH /api/messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
