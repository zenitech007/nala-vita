// src/lib/amelia/llm.ts
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chat(messages: ChatTurn[], opts?: { temperature?: number; maxTokens?: number }): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: opts?.temperature ?? 0.4,
    max_tokens: opts?.maxTokens ?? 800,
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}
