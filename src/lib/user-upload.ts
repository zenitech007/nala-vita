import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BodyReadError, readBoundedBody } from "@/lib/bounded-body";
import { FILE_TYPES, MAX_FILE_BYTES, hasExpectedFileSignature } from "@/lib/upload-types";

export const MEDICAL_FILE_BUCKET = "medical-files";

export async function readUploadForm(request: Request) {
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) {
    throw new BodyReadError(415, "Expected multipart form data");
  }
  const body = await readBoundedBody(request, MAX_FILE_BYTES + 64 * 1024);
  try {
    return await new Response(new Uint8Array(body), { headers: { "Content-Type": contentType } }).formData();
  } catch {
    throw new BodyReadError(400, "Invalid multipart form data");
  }
}

export async function storeUserUpload(input: {
  userId: string;
  file: File;
  category: string;
  receiverId?: string;
  signedUrl?: boolean;
}) {
  const { userId, file, category, receiverId } = input;
  if (file.size < 1) throw new BodyReadError(400, "File is empty");
  if (file.size > MAX_FILE_BYTES) throw new BodyReadError(413, "File must be at most 10 MB");
  if (!Object.hasOwn(FILE_TYPES, file.type)) throw new BodyReadError(400, "File type is not allowed");
  const mimeType = file.type as keyof typeof FILE_TYPES;
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedFileSignature(bytes, mimeType)) {
    throw new BodyReadError(400, "File contents do not match its file type");
  }
  const quota = Number(process.env.UPLOAD_QUOTA_BYTES || 100 * 1024 * 1024);
  if (!Number.isSafeInteger(quota) || quota < 1) throw new BodyReadError(503, "Upload quota is unavailable");
  const prefix = receiverId ? `chat/${userId}/${receiverId}` : userId;
  const storagePath = `${prefix}/${randomUUID()}.${FILE_TYPES[mimeType]}`;
  // Reserve quota before storage I/O. The metadata ID is returned only after success.
  const record = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`upload:${userId}`}, 0))::text`;
    const used = await tx.fileUpload.aggregate({ where: { userId }, _sum: { fileSize: true } });
    if ((used._sum.fileSize ?? 0) + file.size > quota) {
      throw new BodyReadError(413, "Your file storage quota has been reached");
    }
    return tx.fileUpload.create({ data: {
      userId, category, storagePath, mimeType,
      fileName: file.name.slice(0, 255), fileSize: file.size,
    } });
  }, { isolationLevel: "ReadCommitted" });

  const bucket = supabaseAdmin.storage.from(MEDICAL_FILE_BUCKET);
  try {
    const uploaded = await bucket.upload(storagePath, bytes, { contentType: mimeType, upsert: false });
    if (uploaded.error) throw new BodyReadError(502, "File upload failed");
    let signedUrl: string | undefined;
    if (input.signedUrl) {
      const signed = await bucket.createSignedUrl(storagePath, 3600);
      if (signed.error || !signed.data) throw new BodyReadError(502, "File link could not be created");
      signedUrl = signed.data.signedUrl;
    }
    return { record, signedUrl };
  } catch (error) {
    try {
      const removed = await bucket.remove([storagePath]);
      if (removed.error) throw new Error("Storage cleanup failed");
      await prisma.fileUpload.delete({ where: { id: record.id } });
    } catch {
      // Keep the reservation counted until an operator can reconcile the object.
      console.error(JSON.stringify({ event: "upload.cleanup_failed", uploadId: record.id }));
    }
    throw error;
  }
}
