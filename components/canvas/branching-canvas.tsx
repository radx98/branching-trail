'use client';

import { CanvasBlock } from "@/components/ui/canvas-block";
import { PrimaryButton } from "@/components/ui/primary-button";
import type { BranchNode, SessionTree } from "@/lib/types/tree";
import {
  type Node,
  type NodeProps,
  type Edge,
  ReactFlow,
  Handle,
  Position,
  Background,
  ReactFlowProvider,
} from "reactflow";
import { useMemo, useState, useEffect } from "react";
import "reactflow/dist/style.css";

type BranchNodeData = {
  sessionId: string;
  node: BranchNode;
  parentId: string | null;
  onSubmitPrompt: (
    sessionId: string,
    nodeId: string,
    prompt: string,
  ) => Promise<void>;
  onSpecifyPrompt: (
    sessionId: string,
    parentNodeId: string,
    prompt: string,
  ) => Promise<void>;
};

type BranchingCanvasProps = {
  session: SessionTree | null;
  onSubmitPrompt: (
    sessionId: string,
    nodeId: string,
    prompt: string,
  ) => Promise<void>;
  onSpecifyPrompt: (
    sessionId: string,
    parentNodeId: string,
    prompt: string,
  ) => Promise<void>;
};

type BuildContext = {
  nodes: Node<BranchNodeData>[];
  edges: Edge[];
  layerCounts: Record<number, number>;
};

const LAYER_X_GAP = 320;
const LAYER_Y_GAP = 240;

const createNodePosition = (depth: number, laneIndex: number) => ({
  x: depth * LAYER_X_GAP,
  y: laneIndex * LAYER_Y_GAP,
});

const traverseTree = (
  item: BranchNode,
  depth: number,
  sessionId: string,
  ctx: BuildContext,
  parentId: string | null,
  handlers: Pick<
    BranchingCanvasProps,
    "onSubmitPrompt" | "onSpecifyPrompt"
  >,
) => {
  const laneIndex = ctx.layerCounts[depth] ?? 0;
  ctx.layerCounts[depth] = laneIndex + 1;

  ctx.nodes.push({
    id: item.id,
    type: "branch-node",
    position: createNodePosition(depth, laneIndex),
    data: {
      sessionId,
      node: item,
      parentId,
      onSubmitPrompt: handlers.onSubmitPrompt,
      onSpecifyPrompt: handlers.onSpecifyPrompt,
    },
  });

  item.children.forEach((child) => {
    ctx.edges.push({
      id: `${item.id}=>${child.id}`,
      source: item.id,
      target: child.id,
      type: "smoothstep",
    });
    traverseTree(child, depth + 1, sessionId, ctx, item.id, handlers);
  });
};

const buildFlowStructure = (
  session: SessionTree,
  handlers: Pick<
    BranchingCanvasProps,
    "onSubmitPrompt" | "onSpecifyPrompt"
  >,
) => {
  const ctx: BuildContext = {
    nodes: [],
    edges: [],
    layerCounts: {},
  };

  traverseTree(session.root, 0, session.id, ctx, null, handlers);

  return { nodes: ctx.nodes, edges: ctx.edges };
};

const BranchNodeRenderer = ({ data }: NodeProps<BranchNodeData>) => {
  const { node, parentId, sessionId, onSubmitPrompt, onSpecifyPrompt } = data;
  const [isEditing, setIsEditing] = useState(
    () => (node.variant === "specify" ? false : node.prompt.length === 0),
  );
  const [draftPrompt, setDraftPrompt] = useState(node.prompt);

  useEffect(() => {
    setDraftPrompt(node.prompt);
  }, [node.prompt]);

  useEffect(() => {
    if (!node.prompt && node.variant !== "specify") {
      setIsEditing(true);
    }
  }, [node.prompt]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = draftPrompt.trim();
    if (!trimmed) {
      return;
    }
    void onSubmitPrompt(sessionId, node.id, trimmed);
    setIsEditing(false);
  };

  const handleSpecify = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = draftPrompt.trim();
    if (!trimmed) {
      return;
    }
    if (!parentId) {
      return;
    }
    void onSpecifyPrompt(sessionId, parentId, trimmed);
    setDraftPrompt("");
    setIsEditing(false);
  };

  const isSpecify = node.variant === "specify";
  const isLoading = node.status === "loading";
  const isError = node.status === "error";

  return (
    <CanvasBlock className="w-72 min-w-[18rem]">
      {parentId ? (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !bg-indigo-400"
        />
      ) : null}
      {node.variant !== "specify" ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !bg-indigo-400"
        />
      ) : null}

      <div className="flex flex-col gap-3">
        <header className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400">
            {node.variant}
          </span>
          {node.title ? (
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">
              {node.title}
            </h3>
          ) : null}
        </header>

        {(isSpecify || isEditing) && (
          <form
            onSubmit={isSpecify ? handleSpecify : handleSubmit}
            className="flex flex-col gap-2"
          >
            <textarea
              value={draftPrompt}
              onChange={(event) => setDraftPrompt(event.target.value)}
              placeholder={
                isSpecify
                  ? "Add a custom prompt for this branch"
                  : "Describe what you want to explore..."
              }
              className="min-h-[96px] rounded-[var(--radius-card)] border border-[color:var(--color-border-soft)] bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
            />
            <PrimaryButton type="submit">
              {isSpecify ? "Create prompt" : "Save prompt"}
            </PrimaryButton>
          </form>
        )}

        {!isSpecify && !isEditing && (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-slate-600">
              {node.prompt}
            </p>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-sm font-medium text-indigo-500 hover:text-indigo-600"
              >
                Edit prompt
              </button>
              {isLoading && (
                <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Refreshing…
                </span>
              )}
            </div>
          </div>
        )}

        {isError && !isEditing && (
          <div className="flex items-start justify-between gap-3 rounded-[var(--radius-card)] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            <span className="leading-relaxed">
              Generation failed. Try refining the prompt and resubmitting.
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="shrink-0 rounded-full border border-rose-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600 hover:bg-rose-100/60"
            >
              Retry
            </button>
          </div>
        )}

        {node.variant === "option" && !node.prompt && !isEditing && (
          <button
            type="button"
            onClick={() => {
              setIsEditing(true);
              setDraftPrompt("");
            }}
            className="text-sm font-medium text-indigo-500 hover:text-indigo-600"
          >
            Add prompt
          </button>
        )}

        {isSpecify && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-sm font-medium text-indigo-500 hover:text-indigo-600"
          >
            Specify direction
          </button>
        )}

        {isLoading && node.variant !== "option" && (
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            Refreshing…
          </span>
        )}
      </div>
    </CanvasBlock>
  );
};

const nodeTypes = { "branch-node": BranchNodeRenderer };

export function BranchingCanvas({
  session,
  onSubmitPrompt,
  onSpecifyPrompt,
}: BranchingCanvasProps) {
  const elements = useMemo(() => {
    if (!session) {
      return { nodes: [], edges: [] };
    }
    return buildFlowStructure(session, { onSubmitPrompt, onSpecifyPrompt });
  }, [session, onSubmitPrompt, onSpecifyPrompt]);

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Select a session to view its tree.
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="h-full w-full">
        <ReactFlow
          className="h-full w-full"
          fitView
          nodes={elements.nodes}
          edges={elements.edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{
            style: { stroke: "rgba(99,102,241,0.35)", strokeWidth: 2 },
          }}
          connectionLineStyle={{
            stroke: "rgba(99,102,241,0.55)",
            strokeWidth: 2,
          }}
          panOnScroll
        >
          <Background gap={24} color="rgba(15,23,42,0.12)" />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
