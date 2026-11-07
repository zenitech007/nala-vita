import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMessagingUser, getAuthorizedMessageParticipant } from "../_access";
import { chatAttachmentCategory, chatAttachmentUrl } from "./shared";
import { BodyReadError } from "@/lib/bounded-body";
import { readUploadForm, storeUserUpload } from "@/lib/user-upload";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getAuthenticatedMessagingUser();
    if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const form = await readUploadForm(req);
    const file = form.get("file");
    const receiverId = form.get("receiverId");
    if (!(file instanceof File) || typeof receiverId !== "string" || receiverId.length > 128) {
      return NextResponse.json({ error: "A file and receiverId are required" }, { status: 400 });
    }
    const receiver = await getAuthorizedMessageParticipant(currentUser, receiverId);
    if (!receiver) return NextResponse.json({ error: "Conversation is not available" }, { status: 404 });
    const { record } = await storeUserUpload({
      userId: currentUser.id, file, receiverId: receiver.id, category: chatAttachmentCategory(receiver.id),
    });
    return NextResponse.json({ attachment: {
      id: record.id, url: chatAttachmentUrl(record.id), fileName: record.fileName,
      fileSize: record.fileSize, mimeType: record.mimeType,
    } }, { status: 201 });
  } catch (error) {
    if (error instanceof BodyReadError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(JSON.stringify({ event: "attachment.upload_failed" }));
    return NextResponse.json({ error: "Attachment upload failed" }, { status: 500 });
  }
}
