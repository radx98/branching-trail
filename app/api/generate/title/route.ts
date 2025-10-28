import { NextResponse } from "next/server";
import { z } from "zod";

import { generateSessionTitle } from "@/lib/server/prompt-generators";

const requestSchema = z.object({
  prompt: z.string().min(1, "Prompt is required.").trim(),
});

export async function POST(request: Request) {
  try {
    const payload = requestSchema.parse(await request.json());
    const result = await generateSessionTitle(payload.prompt);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body.", issues: error.issues },
        { status: 422 },
      );
    }

    console.error("Failed to generate session title", error);
    return NextResponse.json(
      { error: "Failed to generate session title." },
      { status: 500 },
    );
  }
}

