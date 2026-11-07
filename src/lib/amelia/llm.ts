import { ProviderTimeoutError, withProviderDeadline, withProviderStreamDeadline } from "@/lib/provider-deadline";
// src/lib/amelia/llm.ts
import { ai, GEMINI_MODEL } from "@/lib/gemini";
import OpenAI from "openai";
import {
  generateClinicalResponse,
  generateClinicalStream,
} from "./clinical-engine";
import type { AmeliaContext } from "./types";

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  context?: AmeliaContext;
  signal?: AbortSignal;
}

export async function chat(
  messages: ChatTurn[],
  opts?: ChatOptions
): Promise<string> {
  const systemInstruction = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const nonSystem = messages.filter((m) => m.role !== "system");
  if (nonSystem.length === 0) {
    return "";
  }

  const input =
    nonSystem.length === 1
      ? nonSystem[0].content
      : nonSystem
          .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
          .join("\n\n");

  // 1. Try Gemini
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    try {
      const response = await withProviderDeadline(signal => ai.models.generateContent({
        model: opts?.model ?? GEMINI_MODEL,
        contents: input,
        config: {
          abortSignal: signal,
          systemInstruction: systemInstruction || undefined,
          maxOutputTokens: opts?.maxTokens,
          temperature: opts?.temperature,
        },
      }), opts?.signal);

      const text = response.text?.trim();
      if (text) return text;
    } catch (geminiError) {
      if (geminiError instanceof ProviderTimeoutError || opts?.signal?.aborted) throw geminiError;
      console.warn("AI provider request failed");
    }
  }

  // 2. Try OpenAI fallback
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
      const openAiMessages = messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }));

      const res = await withProviderDeadline(signal => openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openAiMessages,
        max_tokens: opts?.maxTokens,
        temperature: opts?.temperature,
      }, { signal }), opts?.signal);

      const text = res.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch (openAiError) {
      if (openAiError instanceof ProviderTimeoutError || opts?.signal?.aborted) throw openAiError;
      console.warn("AI provider request failed");
    }
  }

  // 3. Resilient Offline Clinical Intelligence Engine
  return generateClinicalResponse(messages, opts?.context);
}

/**
 * Streaming counterpart to chat. Yields content deltas as they arrive.
 */
export async function* chatStream(
  messages: ChatTurn[],
  opts?: ChatOptions
): AsyncGenerator<string> {
  const systemInstruction = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const nonSystem = messages.filter((m) => m.role !== "system");
  if (nonSystem.length === 0) {
    return;
  }

  const input =
    nonSystem.length === 1
      ? nonSystem[0].content
      : nonSystem
          .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
          .join("\n\n");

  // 1. Try Gemini streaming
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    try {
      const stream = withProviderStreamDeadline(signal => ai.models.generateContentStream({
        model: opts?.model ?? GEMINI_MODEL,
        contents: input,
        config: {
          abortSignal: signal,
          systemInstruction: systemInstruction || undefined,
          maxOutputTokens: opts?.maxTokens,
          temperature: opts?.temperature,
        },
      }), opts?.signal);

      let streamedAny = false;
      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          streamedAny = true;
          yield text;
        }
      }
      if (streamedAny) return;
    } catch (geminiError) {
      if (geminiError instanceof ProviderTimeoutError || opts?.signal?.aborted) throw geminiError;
      console.warn("AI provider request failed");
    }
  }

  // 2. Try OpenAI streaming fallback
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
      const openAiMessages = messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }));

      const stream = withProviderStreamDeadline(signal => openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openAiMessages,
        max_tokens: opts?.maxTokens,
        temperature: opts?.temperature,
        stream: true,
      }, { signal }), opts?.signal);

      let streamedAny = false;
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) {
          streamedAny = true;
          yield text;
        }
      }
      if (streamedAny) return;
    } catch (openAiError) {
      if (openAiError instanceof ProviderTimeoutError || opts?.signal?.aborted) throw openAiError;
      console.warn("AI provider request failed");
    }
  }

  // 3. Fall back to Offline Clinical Intelligence Engine stream
  for await (const delta of generateClinicalStream(messages, opts?.context)) {
    yield delta;
  }
}

/**
 * Multimodal vision processing for lab reports and medical imagery.
 */
export async function visionChat(
  prompt: string,
  imageDataUrl: string,
  opts?: { temperature?: number; maxTokens?: number; model?: string; signal?: AbortSignal }
): Promise<string> {
  let mimeType = "image/jpeg";
  let base64Data = imageDataUrl;

  if (imageDataUrl.includes(";base64,")) {
    const parts = imageDataUrl.split(";base64,");
    mimeType = parts[0].replace(/^data:/, "") || "image/jpeg";
    base64Data = parts[1];
  }

  // 1. Try Gemini Vision (gemini-2.5-flash natively handles image parts)
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    try {
      const response = await withProviderDeadline(signal => ai.models.generateContent({
        model: opts?.model ?? GEMINI_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        config: {
          abortSignal: signal,
          maxOutputTokens: opts?.maxTokens ?? 1000,
          temperature: opts?.temperature ?? 0.2,
        },
      }), opts?.signal);

      const text = response.text?.trim();
      if (text) return text;
    } catch (geminiError) {
      if (geminiError instanceof ProviderTimeoutError || opts?.signal?.aborted) throw geminiError;
      console.warn("AI provider request failed");
    }
  }

  // 2. Try OpenAI Vision (gpt-4o-mini supports high-resolution image URLs)
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
      const res = await withProviderDeadline(signal => openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: imageDataUrl },
              },
            ],
          },
        ],
        max_tokens: opts?.maxTokens ?? 1000,
        temperature: opts?.temperature ?? 0.2,
      }, { signal }), opts?.signal);

      const text = res.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch (openAiError) {
      if (openAiError instanceof ProviderTimeoutError || opts?.signal?.aborted) throw openAiError;
      console.warn("AI provider request failed");
    }
  }

  // Provider failure must never manufacture clinical findings.
  return JSON.stringify({status: 'unavailable', results: [], summary: 'The report could not be read. Please retry.', overallNote: 'Review the original report with your healthcare provider.'});
}
