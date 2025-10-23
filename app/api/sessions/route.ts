import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ApiError, requireAuthenticatedClient } from "@/lib/server/auth";
import {
  generateBranchOptions,
  generateSessionTitle,
} from "@/lib/server/prompt-generators";
import {
  insertSession,
  listSessionsForUser,
  mapRowToSessionTree,
} from "@/lib/server/session-repository";
import { createSessionBodySchema } from "@/lib/server/schemas";
import type { BranchNode } from "@/lib/types/tree";
import { createOptionNode, createSpecifyNode } from "@/lib/tree/builders";

export async function GET() {
  try {
    const { supabase, user } = await requireAuthenticatedClient();
    const rows = await listSessionsForUser(supabase, user.id);
    return NextResponse.json({
      sessions: rows.map((row) => mapRowToSessionTree(row)),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Failed to load sessions", error);
    return NextResponse.json(
      { error: "Failed to load sessions." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = createSessionBodySchema.parse(await request.json());
    const { supabase, user } = await requireAuthenticatedClient();

    const rootId = `session-root-${randomUUID()}`;

    const [{ title, tokens: titleTokens }, { options, tokens: optionTokens }] =
      await Promise.all([
        generateSessionTitle(payload.prompt),
        generateBranchOptions({ prompt: payload.prompt }),
      ]);

    const children = options.map((option, index) =>
      createOptionNode({ parentId: rootId, index, title: option }),
    );
    children.push(createSpecifyNode(rootId));

    const rootNode: BranchNode = {
      id: rootId,
      title,
      prompt: payload.prompt,
      variant: "prompt",
      status: "idle",
      children,
    };

    const totalTokens = titleTokens + optionTokens;

    const row = await insertSession(supabase, user.id, {
      title,
      tree: rootNode,
      tokenUsage: totalTokens,
    });

    return NextResponse.json(
      {
        session: mapRowToSessionTree(row),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body.", issues: error.issues },
        { status: 422 },
      );
    }

    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Failed to create session", error);
    return NextResponse.json(
      { error: "Failed to create session." },
      { status: 500 },
    );
  }
}
