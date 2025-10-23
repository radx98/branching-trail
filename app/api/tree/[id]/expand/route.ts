import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { ApiError, requireAuthenticatedClient } from "@/lib/server/auth";
import {
  generateBranchOptions,
  generateSessionTitle,
} from "@/lib/server/prompt-generators";
import {
  fetchSession,
  mapRowToSessionTree,
  updateSessionTree,
} from "@/lib/server/session-repository";
import { expandNodeBodySchema } from "@/lib/server/schemas";
import type { BranchNode } from "@/lib/types/tree";
import { createOptionNode, createSpecifyNode } from "@/lib/tree/builders";
import {
  cloneTree,
  ensureSpecifyChild,
  findNodeWithTrail,
  walkTree,
} from "@/lib/tree/operations";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params;
    const payload = expandNodeBodySchema.parse(await request.json());
    const { supabase, user } = await requireAuthenticatedClient();

    const row = await fetchSession(supabase, sessionId, user.id);
    const tree = cloneTree(row.tree_json);

    let updatedTitle: string | undefined;
    let tokensConsumed = 0;

    if (payload.mode === "submit") {
      const match = findNodeWithTrail(tree, payload.nodeId);
      if (!match) {
        throw new ApiError(404, "Target node not found.");
      }

      const breadcrumbTitles = match.breadcrumb
        .filter((node) => node.variant !== "specify")
        .map((node) => node.title)
        .filter((title) => Boolean(title));

      match.node.prompt = payload.prompt;
      match.node.status = "idle";

      const { options, tokens } = await generateBranchOptions({
        prompt: payload.prompt,
        nodeTitle: match.node.title,
        breadcrumb: breadcrumbTitles,
      });

      tokensConsumed += tokens;

      match.node.children = options.map((option, index) =>
        createOptionNode({
          parentId: match.node.id,
          index,
          title: option,
        }),
      );
      match.node.children.push(createSpecifyNode(match.node.id));

      // If this is the root node, refresh the session title.
      if (match.parent === null) {
        const { title, tokens: titleTokens } = await generateSessionTitle(
          payload.prompt,
        );
        tokensConsumed += titleTokens;
        updatedTitle = title;
        match.node.title = title;
      }
    } else {
      const match = findNodeWithTrail(tree, payload.parentNodeId);
      if (!match) {
        throw new ApiError(404, "Parent node not found.");
      }

      const breadcrumbTitles = [
        ...match.breadcrumb
          .filter((node) => node.variant !== "specify")
          .map((node) => node.title)
          .filter(Boolean),
        match.node.variant !== "specify" ? match.node.title : "",
      ].filter(Boolean);

      const { options, tokens } = await generateBranchOptions({
        prompt: payload.prompt,
        breadcrumb: breadcrumbTitles,
      });

      tokensConsumed += tokens;

      const newNodeId = `${match.node.id}::spec-${randomUUID()}`;
      const newNode: BranchNode = {
        id: newNodeId,
        title: "",
        prompt: payload.prompt,
        variant: "prompt",
        status: "idle",
        children: options.map((option, index) =>
          createOptionNode({
            parentId: newNodeId,
            index,
            title: option,
          }),
        ),
      };
      newNode.children.push(createSpecifyNode(newNodeId));

      match.node.children = [
        ...match.node.children.filter((child) => child.variant !== "specify"),
        newNode,
        createSpecifyNode(match.node.id),
      ];
    }

    walkTree(tree, (node) => ensureSpecifyChild(node, createSpecifyNode));

    const newUsage = (row.token_usage ?? 0) + tokensConsumed;

    const updatedRow = await updateSessionTree(supabase, sessionId, user.id, {
      title: updatedTitle,
      tree,
      tokenUsage: newUsage,
    });

    return NextResponse.json({
      session: mapRowToSessionTree(updatedRow),
    });
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

    console.error("Failed to expand node", error);
    return NextResponse.json(
      { error: "Failed to expand node." },
      { status: 500 },
    );
  }
}
