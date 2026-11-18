import { parsePagination, cursorWhere, pageResult, PaginationError } from "@/lib/pagination";
import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// ─── GET: Return notifications for the current user ──────

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR", "ADMIN"] });
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const { limit, cursor } = parsePagination(searchParams, 20);

    const whereClause: Record<string, unknown> = { userId: user.id };
    if (unreadOnly) {
      whereClause.isRead = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { AND: [whereClause, cursorWhere(cursor, "createdAt")] },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      }),
      prisma.notification.count({
        where: { userId: user.id, isRead: false },
      }),
    ]);

    const page = pageResult(notifications, limit, "createdAt");
    return NextResponse.json({ notifications: page.items, unreadCount, nextCursor: page.nextCursor });
  } catch (error) {
    if (error instanceof PaginationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── PATCH: Mark notification(s) as read ─────────────────

const markReadSchema = z.object({
  notificationIds: z.array(z.string()).optional(),
  markAllRead: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR", "ADMIN"] });
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const body = await req.json();
    const validated = markReadSchema.parse(body);

    if (validated.markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      });
    } else if (validated.notificationIds && validated.notificationIds.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: validated.notificationIds },
          userId: user.id,
        },
        data: { isRead: true },
      });
    } else {
      return NextResponse.json(
        { error: "Provide notificationIds or markAllRead" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
