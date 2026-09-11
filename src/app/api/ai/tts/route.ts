import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateSpeech } from "@/lib/gemini";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const bodySchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const authRes = await supabase.auth.getUser().catch(() => null);
    const user = authRes?.data?.user;
    
    // Rate limit per user or client IP
    const clientId = user?.id || req.headers.get("x-forwarded-for") || "anonymous";
    const limit = await checkRateLimitAsync(`ai:tts:${clientId}`, {
      maxRequests: 30,
      windowMs: 60_000,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment.", fallback: true },
        { status: 429 }
      );
    }

    const { text, voice } = bodySchema.parse(await req.json());

    // Strip out markdown symbols (headings, bold, bullets) so TTS reads cleanly
    const plainText = text
      .replace(/[*_#`~>\[\]]/g, "")
      .replace(/\(http[^)]+\)/g, "")
      .trim();

    const { audioBase64, mimeType } = await generateSpeech({
      text: plainText,
      voiceName: voice,
    });

    if (audioBase64 && mimeType) {
      return NextResponse.json({
        success: true,
        audioData: `data:${mimeType};base64,${audioBase64}`,
        format: mimeType,
        fallback: false,
      });
    }

    // Signal client to seamlessly use native browser SpeechSynthesis
    return NextResponse.json({
      success: false,
      fallback: true,
      message: "Server TTS unavailable, client speech synthesis recommended",
    });
  } catch (error) {
    console.error("TTS generation error:", error);
    return NextResponse.json(
      { success: false, fallback: true, error: "Failed to generate speech" },
      { status: 200 }
    );
  }
}
