import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { BodyReadError } from "@/lib/bounded-body";
import { readUploadForm, storeUserUpload } from "@/lib/user-upload";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR", "ADMIN"] });
    if (!auth.ok) return auth.response;
    const form = await readUploadForm(req);
    const file = form.get("file");
    const category = form.get("category") ?? "general";
    if (!(file instanceof File)) return NextResponse.json({ error: "A file is required" }, { status: 400 });
    if (typeof category !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(category)) {
      return NextResponse.json({ error: "Invalid file category" }, { status: 400 });
    }
    const { record, signedUrl } = await storeUserUpload({ userId: auth.user.id, file, category, signedUrl: true });
    return NextResponse.json({ message: "File uploaded successfully", file: {
      id: record.id, fileName: record.fileName, fileSize: record.fileSize, mimeType: record.mimeType,
      category: record.category, signedUrl, createdAt: record.createdAt,
    } }, { status: 201 });
  } catch (error) {
    if (error instanceof BodyReadError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(JSON.stringify({ event: "file.upload_failed" }));
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }
}
