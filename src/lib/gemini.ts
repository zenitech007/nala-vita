import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "models/gemini-3.6-flash";

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
});
