import { z } from "zod";
import { hasExpectedFileSignature } from "@/lib/upload-types";

export const MAX_IMAGE_DATA_URL = 1_800_000;
export const imageDataUrlSchema = z.string().max(MAX_IMAGE_DATA_URL).refine(value => {
  if (value.length > MAX_IMAGE_DATA_URL) return false;
  const match = /^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return false;
  const mime = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  return hasExpectedFileSignature(Buffer.from(match[2].slice(0, 16), "base64"), mime);
}, "Image must be a valid JPEG, PNG, GIF or WebP data URL");
