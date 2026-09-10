// src/lib/amelia/llm.ts
import { ai, GEMINI_MODEL } from "@/lib/gemini";
interface TextContent {
  type: "text";
  text: string;
}

interface ImageContent {
  type: "image";
  data?: string;
  mime_type?: string;
}

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chat(
  messages: ChatTurn[],
  opts?: { temperature?: number; maxTokens?: number; model?: string }
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

  const response = await ai.interactions.create({
    model: opts?.model ?? GEMINI_MODEL,
    input,
    system_instruction: systemInstruction || undefined,
    generation_config: opts?.maxTokens ? { max_output_tokens: opts.maxTokens } : undefined,
  });

  return response.output_text?.trim() ?? "";
}

/**
 * Streaming counterpart to {@link chat}. Yields content deltas as they arrive.
 */
export async function* chatStream(
  messages: ChatTurn[],
  opts?: { temperature?: number; maxTokens?: number; model?: string }
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

  const stream = await ai.interactions.create({
    model: opts?.model ?? GEMINI_MODEL,
    input,
    system_instruction: systemInstruction || undefined,
    generation_config: opts?.maxTokens ? { max_output_tokens: opts.maxTokens } : undefined,
    stream: true,
  });

  for await (const event of stream) {
    if (event.event_type === "step.delta" && event.delta && "text" in event.delta) {
      const text = (event.delta as { text?: string }).text;
      if (text) yield text;
    }
  }
}

export async function visionChat(
  prompt: string,
  imageDataUrl: string,
  opts?: { temperature?: number; maxTokens?: number; model?: string }
): Promise<string> {
  let mimeType = "image/jpeg";
  let base64Data = imageDataUrl;

  if (imageDataUrl.includes(";base64,")) {
    const parts = imageDataUrl.split(";base64,");
    mimeType = parts[0].replace(/^data:/, "") || "image/jpeg";
    base64Data = parts[1];
  }

  const textPart: TextContent = {
    type: "text",
    text: prompt,
  };

  const imagePart: ImageContent = {
    type: "image",
    data: base64Data,
    mime_type: mimeType as any,
  };

  const response = await ai.interactions.create({
    model: opts?.model ?? GEMINI_MODEL,
    input: [textPart, imagePart],
    generation_config: opts?.maxTokens ? { max_output_tokens: opts.maxTokens } : undefined,
  });

  return response.output_text?.trim() ?? "";
}
