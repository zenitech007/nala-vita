import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

// Current official Gemini models
export const GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_FLASH_LITE = "gemini-2.5-flash-lite";
export const GEMINI_TTS_MODEL = "gemini-2.5-flash";

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

export const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
});

/**
 * Generates spoken audio using Gemini TTS (gemini-2.5-flash with AUDIO modality),
 * falling back to OpenAI TTS if Gemini is unavailable or denied access.
 */
export async function generateSpeech(params: {
  text: string;
  voiceName?: string;
}): Promise<{ audioBase64: string | null; mimeType: string | null }> {
  const { text, voiceName = "Puck" } = params;

  // 1. Try Gemini Text-to-Speech (gemini-2.5-flash)
  if (geminiApiKey) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_TTS_MODEL,
        contents: text,
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        } as any,
      });

      const candidates = response.candidates;
      if (candidates && candidates[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData?.data) {
            return {
              audioBase64: part.inlineData.data,
              mimeType: part.inlineData.mimeType || "audio/wav",
            };
          }
        }
      }
    } catch (geminiError) {
      console.warn("Gemini TTS call failed, falling back to secondary providers:", (geminiError as Error)?.message || geminiError);
    }
  }

  // 2. Try OpenAI TTS fallback
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: "nova",
        input: text,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      return {
        audioBase64: buffer.toString("base64"),
        mimeType: "audio/mp3",
      };
    } catch (openAiError) {
      console.warn("OpenAI TTS fallback failed:", (openAiError as Error)?.message || openAiError);
    }
  }

  return { audioBase64: null, mimeType: null };
}
