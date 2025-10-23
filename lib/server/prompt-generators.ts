import { getOpenAIClient } from "@/lib/openai";

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

type GenerationUsage = {
  tokens: number;
};

export async function generateSessionTitle(
  prompt: string,
): Promise<{ title: string } & GenerationUsage> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.7,
    max_tokens: 60,
    messages: [
      {
        role: "system",
        content:
          "You are a naming assistant that crafts concise, intriguing brainstorming session titles. Respond with a single title no longer than six words.",
      },
      {
        role: "user",
        content: [
          `Prompt or theme: ${prompt}`,
          "",
          "Return only the title text. Do not include quotes or explanations.",
        ].join("\n"),
      },
    ],
  });

  const content =
    completion.choices[0]?.message?.content?.trim() ?? "New Session";

  return {
    title: sanitiseSingleLine(content),
    tokens: completion.usage?.total_tokens ?? 0,
  };
}

export async function generateBranchOptions({
  prompt,
  nodeTitle,
  breadcrumb = [],
}: {
  prompt: string;
  nodeTitle?: string;
  breadcrumb?: string[];
}): Promise<{ options: string[] } & GenerationUsage> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.85,
    max_tokens: 500,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You help product teams explore creative directions through branching prompts.",
          "Given the user's latest prompt (and optional context), respond with a JSON object: {\"options\": [string, string, string, string]}",
          "Each string should be an evocative, specific angle or framing. Keep them under 12 words. Do not add numbering or commentary.",
        ].join(" "),
      },
      {
        role: "user",
        content: buildBranchingUserMessage({ prompt, nodeTitle, breadcrumb }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";

  const parsed = parseOptionsPayload(raw);

  return {
    options: parsed,
    tokens: completion.usage?.total_tokens ?? 0,
  };
}

function parseOptionsPayload(payload: string): string[] {
  try {
    const result = JSON.parse(payload) as {
      options?: unknown;
    };

    if (!Array.isArray(result.options)) {
      throw new Error("Missing options array.");
    }

    const options = result.options
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);

    if (options.length !== 4) {
      throw new Error("Expected four option strings.");
    }

    return options.map(sanitiseSingleLine);
  } catch (error) {
    throw new Error(
      `Failed to parse options payload from OpenAI: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function buildBranchingUserMessage({
  prompt,
  nodeTitle,
  breadcrumb,
}: {
  prompt: string;
  nodeTitle?: string;
  breadcrumb: string[];
}) {
  const contextLines = [];

  if (breadcrumb.length > 0) {
    contextLines.push(`Previous selections: ${breadcrumb.join(" → ")}`);
  }

  if (nodeTitle) {
    contextLines.push(`Current option title: ${nodeTitle}`);
  }

  contextLines.push(`User prompt: ${prompt}`);

  return contextLines.join("\n");
}

function sanitiseSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
