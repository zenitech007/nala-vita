import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthenticatedMessagingUser } from "../../_access";
import {
  CHAT_ATTACHMENT_BUCKET,
  CHAT_ATTACHMENT_CATEGORY_PREFIX,
  chatAttachmentCategory,
  chatAttachmentUrl,
} from "../shared";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function findAuthorizedAttachment(userId: string, fileId: string) {
  const file = await prisma.fileUpload.findUnique({
    where: { id: fileId },
  });

  if (!file?.category.startsWith(CHAT_ATTACHMENT_CATEGORY_PREFIX)) return null;

  const message = await prisma.message.findFirst({
    where: {
      attachmentUrl: chatAttachmentUrl(file.id),
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    select: { senderId: true, receiverId: true },
  });

  if (
    !message ||
    file.userId !== message.senderId ||
    file.category !== chatAttachmentCategory(message.receiverId)
  ) {
    return null;
  }

  return file;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const currentUser = await getAuthenticatedMessagingUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const file = await findAuthorizedAttachment(currentUser.id, id);
    if (!file) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin.storage
      .from(CHAT_ATTACHMENT_BUCKET)
      .download(file.storagePath);

    if (error || !data) {
      console.error("Chat attachment download error:", error);
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    const fallbackName = file.fileName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/"/g, "");
    const encodedName = encodeURIComponent(file.fileName);

    return new NextResponse(await data.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.fileSize),
        "Content-Disposition": `inline; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET /api/messages/attachments/[id] error:", error);
    return NextResponse.json(
      { error: "Unable to retrieve attachment" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const currentUser = await getAuthenticatedMessagingUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const file = await prisma.fileUpload.findUnique({
      where: { id },
    });
    if (
      !file ||
      file.userId !== currentUser.id ||
      !file.category.startsWith(CHAT_ATTACHMENT_CATEGORY_PREFIX)
    ) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    const linkedMessage = await prisma.message.findFirst({
      where: { attachmentUrl: chatAttachmentUrl(file.id) },
      select: { id: true },
    });
    if (linkedMessage) {
      return NextResponse.json(
        { error: "Sent attachments cannot be deleted" },
        { status: 409 }
      );
    }

    const { error: storageError } = await supabaseAdmin.storage
      .from(CHAT_ATTACHMENT_BUCKET)
      .remove([file.storagePath]);
    if (storageError) {
      console.error("Chat attachment cleanup error:", storageError);
      return NextResponse.json(
        { error: "Unable to delete attachment" },
        { status: 500 }
      );
    }

    await prisma.fileUpload.delete({ where: { id: file.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/messages/attachments/[id] error:", error);
    return NextResponse.json(
      { error: "Unable to delete attachment" },
      { status: 500 }
    );
  }
}
