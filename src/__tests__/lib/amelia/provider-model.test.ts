import { ai, GEMINI_MODEL } from "@/lib/gemini";
import { detectReminder } from "@/lib/amelia/reminders";

jest.mock("@/lib/gemini", () => ({
  ai: { models: { generateContent: jest.fn() } },
  GEMINI_MODEL: "gemini-test",
}));
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/notifications", () => ({ createNotification: jest.fn() }));

test("reminder detection uses the Gemini model for a Gemini request", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "synthetic";
  try {
    jest.mocked(ai.models.generateContent).mockResolvedValue({ text: "null" } as Awaited<ReturnType<typeof ai.models.generateContent>>);
    await expect(detectReminder("Hello", "Hi there")).resolves.toBeNull();
    expect(ai.models.generateContent).toHaveBeenCalledWith(expect.objectContaining({ model: GEMINI_MODEL }));
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});
