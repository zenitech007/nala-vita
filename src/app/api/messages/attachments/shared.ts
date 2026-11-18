export const CHAT_ATTACHMENT_BUCKET = "medical-files";
export const CHAT_ATTACHMENT_CATEGORY_PREFIX = "chat-attachment:";

export function chatAttachmentCategory(receiverId: string) {
  return `${CHAT_ATTACHMENT_CATEGORY_PREFIX}${receiverId}`;
}

export function chatAttachmentUrl(fileId: string) {
  return `/api/messages/attachments/${fileId}`;
}

export function parseChatAttachmentId(value: string | null | undefined) {
  if (!value) return null;
  const match = /^\/api\/messages\/attachments\/([a-zA-Z0-9_-]+)$/.exec(
    value
  );
  return match?.[1] || null;
}

