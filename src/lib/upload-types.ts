export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FILE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

export function hasExpectedFileSignature(
  bytes: Uint8Array,
  mimeType: keyof typeof FILE_TYPES
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
