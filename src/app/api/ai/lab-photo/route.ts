import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { extractLabsFromImage } from "@/lib/amelia/labvision";

const MAX_LEN = 1_800_000; // ~1.8MB of base64
const bodySchema = z.object({
  imageDataUrl: z
    .string()
    .regex(/^data:image\/[a-zA-Z]+;base64,/, "Must be a base64 image data URL")
    .max(MAX_LEN, "Image too large"),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      include: { patient: true },
    });
    if (!user?.patient)
      return NextResponse.json(
        { error: "Patient profile not found" },
        { status: 404 }
      );

    const limit = await checkRateLimitAsync(
      `amelia:lab-photo:${user.id}`,
      { maxRequests: 5, windowMs: 60_000 }
    );
    if (!limit.allowed)
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );

    const { imageDataUrl } = bodySchema.parse(await req.json());
    const result = await extractLabsFromImage(imageDataUrl);
    return NextResponse.json(result);
  } catch (error) {
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
