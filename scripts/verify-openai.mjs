import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
try {
  const mini = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "user", content: "reply with only: OK" }], max_tokens: 5 });
  console.log("gpt-4o-mini (memory/reminder/medcoach extraction):", JSON.stringify(mini.choices[0]?.message?.content?.trim()));
  const full = await openai.chat.completions.create({ model: "gpt-4o", messages: [{ role: "user", content: "reply with only: OK" }], max_tokens: 5 });
  console.log("gpt-4o (chat engine + lab-photo vision):", JSON.stringify(full.choices[0]?.message?.content?.trim()));
  console.log("RESULT: OpenAI key valid; both models reachable.");
} catch (e) {
  console.error("OPENAI FAILED:", e?.status ?? "", e?.message ?? e);
  process.exitCode = 1;
}
