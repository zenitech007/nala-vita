export const CHAT_ATTACHMENT_BUCKET = "medical-files";
export const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_ATTACHMENT_CATEGORY_PREFIX = "chat-attachment:";

export const CHAT_ATTACHMENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

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

export function hasExpectedFileSignature(
  bytes: Uint8Array,
  mimeType: keyof typeof CHAT_ATTACHMENT_TYPES
) {
  const startsWith = (signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);

  switch (mimeType) {
    case "image/jpeg":
      return startsWith([0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif": {
      const header = new TextDecoder().decode(bytes.slice(0, 6));
      return header === "GIF87a" || header === "GIF89a";
    }
    case "image/webp": {
      const riff = new TextDecoder().decode(bytes.slice(0, 4));
      const webp = new TextDecoder().decode(bytes.slice(8, 12));
      return riff === "RIFF" && webp === "WEBP";
    }
    case "application/pdf":
      return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  }
}
