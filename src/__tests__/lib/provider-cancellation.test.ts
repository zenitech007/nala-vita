const generate = jest.fn();
jest.mock("@/lib/gemini", () => ({ ai: { models: { generateContent: (...args: unknown[]) => generate(...args) } }, GEMINI_MODEL: "gemini-test" }));
import { chat } from "@/lib/amelia/llm";
import { ProviderTimeoutError } from "@/lib/provider-deadline";

const original = process.env.GEMINI_API_KEY;
beforeEach(() => {
  process.env.GEMINI_API_KEY = "synthetic-key";
  generate.mockReset();
});
afterEach(() => {
  if (original === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = original;
  jest.useRealTimers();
});
it("F35 forwards a cancellation signal to the Gemini request", async () => {
  generate.mockResolvedValue({ text: "Synthetic response" });
  const controller = new AbortController();
  expect(await chat([{ role: "user", content: "Synthetic prompt" }], { signal: controller.signal })).toBe("Synthetic response");
  expect(generate).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ abortSignal: expect.any(AbortSignal) }) }));
});
it("F35 returns on deadline even when the SDK leaves its promise pending", async () => {
  jest.useFakeTimers();
  generate.mockImplementation(() => new Promise(() => undefined));
  const result = chat([{ role: "user", content: "Synthetic prompt" }]);
  const rejected = expect(result).rejects.toBeInstanceOf(ProviderTimeoutError);
  await jest.advanceTimersByTimeAsync(15_000);
  await rejected;
  expect(generate.mock.calls[0][0].config.abortSignal.aborted).toBe(true);
});
it("F35 propagates client cancellation without invoking fallback", async () => {
  generate.mockImplementation(() => new Promise(() => undefined));
  const controller = new AbortController();
  const result = chat([{ role: "user", content: "Synthetic prompt" }], { signal: controller.signal });
  controller.abort(new Error("Synthetic client disconnect"));
  await expect(result).rejects.toThrow("Synthetic client disconnect");
  expect(generate.mock.calls[0][0].config.abortSignal.aborted).toBe(true);
});
