import { ai } from "@/lib/gemini";
import { chatStream } from "@/lib/amelia/llm";
import { generateClinicalStream } from "@/lib/amelia/clinical-engine";

jest.mock("@/lib/gemini", () => ({
  ai: { models: { generateContentStream: jest.fn() } },
  GEMINI_MODEL: "gemini-test",
}));
jest.mock("./../../../lib/amelia/clinical-engine", () => ({
  generateClinicalStream: jest.fn(async function* () { yield "Fallback"; }),
}));

test("a failed provider cannot fall back after emitting content", async () => {
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  process.env.GEMINI_API_KEY = "synthetic";
  delete process.env.OPENAI_API_KEY;
  const failure = new Error("synthetic disconnect");
  try {
    async function* failedStream() {
      yield { text: "Partial" };
      throw failure;
    }
    jest.mocked(ai.models.generateContentStream).mockResolvedValue(
      failedStream() as Awaited<ReturnType<typeof ai.models.generateContentStream>>,
    );
    const stream = chatStream([{ role: "user", content: "Hello" }]);
    await expect(stream.next()).resolves.toEqual({ done: false, value: "Partial" });
    await expect(stream.next()).rejects.toBe(failure);
    expect(generateClinicalStream).not.toHaveBeenCalled();
  } finally {
    if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGeminiKey;
    if (previousOpenAiKey !== undefined) process.env.OPENAI_API_KEY = previousOpenAiKey;
  }
});
