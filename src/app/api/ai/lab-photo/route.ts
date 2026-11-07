import { ProviderTimeoutError, providerTimeoutResponse } from "@/lib/provider-deadline";
import { BodyReadError, readBoundedJson } from "@/lib/bounded-body";
import { imageDataUrlSchema, MAX_IMAGE_DATA_URL } from "@/lib/image-data-url";
import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { extractLabsFromImage } from "@/lib/amelia/labvision";

const bodySchema = z.object({ imageDataUrl: imageDataUrlSchema });

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const limit = await checkRateLimitAsync(
      `amelia:lab-photo:${user.id}`,
      { maxRequests: 5, windowMs: 60_000 }
    );
    if (!limit.allowed)
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );

    const { imageDataUrl } = bodySchema.parse(await readBoundedJson(req, MAX_IMAGE_DATA_URL + 32_768));
    const result = await extractLabsFromImage(imageDataUrl, req.signal);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProviderTimeoutError) return providerTimeoutResponse();
    if (error instanceof BodyReadError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 }
      );
    }
    console.error("Lab photo OCR error:", error);
    return NextResponse.json(
      { error: "Failed to read the lab photo." },
      { status: 500 }
    );
  }
}
