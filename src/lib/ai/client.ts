import OpenAI from "openai";

let cached: OpenAI | null = null;

export function getOpenAi(): OpenAI {
  if (cached) return cached;
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local from https://platform.openai.com/api-keys.",
    );
  }
  cached = new OpenAI({ apiKey: key });
  return cached;
}

// Default model for AI helper. gpt-4o is current flagship; override via env if
// you want gpt-4o-mini for cost or another model.
export const AI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";
