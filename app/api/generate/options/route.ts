import { NextResponse } from "next/server";
import { z } from "zod";

import { generateBranchOptions } from "@/lib/server/prompt-generators";

const requestSchema = z.object({
  prompt: z.string().min(1, "Prompt is required.").trim(),
  nodeTitle: z.string().optional(),
  breadcrumb: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const payload = requestSchema.parse(await request.json());

    const result = await generateBranchOptions({
      prompt: payload.prompt,
      nodeTitle: payload.nodeTitle,
      breadcrumb: payload.breadcrumb ?? [],
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body.", issues: error.issues },
        { status: 422 },
      );
    }

    console.error("Failed to generate branch options", error);
    return NextResponse.json(
      { error: "Failed to generate branch options." },
      { status: 500 },
    );
  }
}

