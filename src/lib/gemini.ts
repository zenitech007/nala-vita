import { ProviderTimeoutError, withProviderDeadline } from "@/lib/provider-deadline";
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
  signal?: AbortSignal;
}): Promise<{ audioBase64: string | null; mimeType: string | null }> {
  const { text, voiceName = "Puck" } = params;

  // 1. Try Gemini Text-to-Speech (gemini-2.5-flash)
  if (geminiApiKey) {
    try {
      const response = await withProviderDeadline(signal => ai.models.generateContent({
        model: GEMINI_TTS_MODEL,
        contents: text,
        config: {
          abortSignal: signal,
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      }), params.signal);

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
      if (geminiError instanceof ProviderTimeoutError || params.signal?.aborted) throw geminiError;
      console.warn("Speech provider request failed");
    }
  }

  // 2. Try OpenAI TTS fallback
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
      const buffer = await withProviderDeadline(async signal => {
        const mp3 = await openai.audio.speech.create({ model: "tts-1", voice: "nova", input: text }, { signal });
        return Buffer.from(await mp3.arrayBuffer());
      }, params.signal);
      return {
        audioBase64: buffer.toString("base64"),
        mimeType: "audio/mp3",
      };
    } catch (openAiError) {
      if (openAiError instanceof ProviderTimeoutError || params.signal?.aborted) throw openAiError;
      console.warn("Speech provider request failed");
    }
  }

  return { audioBase64: null, mimeType: null };
}
