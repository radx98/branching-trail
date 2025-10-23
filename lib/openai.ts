import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function getOpenAIClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenAI client cannot be initialised. Ensure OPENAI_API_KEY is configured.",
    );
  }

  cachedClient = new OpenAI({
    apiKey,
  });

  return cachedClient;
}
