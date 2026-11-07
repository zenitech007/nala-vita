import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateSpeech } from "@/lib/gemini";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { requireApiUser } from "@/lib/auth";
import { limitByTrustedIp, rateLimitResponse } from "@/lib/request-rate-limit";

const bodySchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR"] });
    if (!auth.ok) return auth.response;
    const ipLimited = await limitByTrustedIp(req, "tts", { maxRequests: 120, windowMs: 60_000 });
    if (ipLimited) return ipLimited;
    const limit = await checkRateLimitAsync(`ai:tts:user:${auth.user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!limit.allowed) return rateLimitResponse(limit);

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
