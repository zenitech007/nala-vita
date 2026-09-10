import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getAuthenticatedMessagingUser,
  getAuthorizedMessageParticipant,
} from "../_access";
import {
  CHAT_ATTACHMENT_BUCKET,
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_ATTACHMENT_TYPES,
  chatAttachmentCategory,
  chatAttachmentUrl,
  hasExpectedFileSignature,
} from "./shared";

export async function POST(req: NextRequest) {
  let uploadedPath: string | null = null;

  try {
    const currentUser = await getAuthenticatedMessagingUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const receiverId = formData.get("receiverId");

    if (!(file instanceof File) || typeof receiverId !== "string") {
      return NextResponse.json(
        { error: "A file and receiverId are required" },
        { status: 400 }
      );
    }

    const receiver = await getAuthorizedMessageParticipant(
      currentUser,
      receiverId
    );
    if (!receiver) {
      return NextResponse.json(
        { error: "Conversation is not available" },
        { status: 404 }
      );
    }

    if (file.size < 1 || file.size > CHAT_ATTACHMENT_MAX_BYTES) {
      return NextResponse.json(
        { error: "Attachment must be between 1 byte and 10 MB" },
        { status: 400 }
      );
    }

    const mimeType = file.type as keyof typeof CHAT_ATTACHMENT_TYPES;
    const extension = CHAT_ATTACHMENT_TYPES[mimeType];
    if (!extension) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, GIF, WebP, and PDF files are allowed" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasExpectedFileSignature(buffer, mimeType)) {
      return NextResponse.json(
        { error: "Attachment contents do not match its file type" },
        { status: 400 }
      );
    }

    const fileId = crypto.randomUUID();
    uploadedPath = `chat/${currentUser.id}/${receiver.id}/${fileId}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(CHAT_ATTACHMENT_BUCKET)
      .upload(uploadedPath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Chat attachment upload error:", uploadError);
      return NextResponse.json(
        { error: "Attachment upload failed" },
        { status: 500 }
      );
    }

    const record = await prisma.fileUpload.create({
      data: {
        userId: currentUser.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType,
        storagePath: uploadedPath,
        category: chatAttachmentCategory(receiver.id),
      },
    });

    return NextResponse.json(
      {
        attachment: {
          id: record.id,
          url: chatAttachmentUrl(record.id),
          fileName: record.fileName,
          fileSize: record.fileSize,
          mimeType: record.mimeType,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (uploadedPath) {
      await supabaseAdmin.storage
        .from(CHAT_ATTACHMENT_BUCKET)
        .remove([uploadedPath])
        .catch(() => undefined);
    }
    console.error("POST /api/messages/attachments error:", error);
    return NextResponse.json(
      { error: "Attachment upload failed" },
      { status: 500 }
    );
  }
}
