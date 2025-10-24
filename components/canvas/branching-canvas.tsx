'use client';

import { CanvasBlock } from "@/components/ui/canvas-block";
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
import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type { SVGProps } from "react";
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
  onExpandOption: (sessionId: string, nodeId: string) => Promise<void>;
};

type BuildContext = {
  nodes: Node<BranchNodeData>[];
  edges: Edge[];
  layerOccupancy: Record<number, number[]>;
  nodeLaneOverrides: Record<string, number>;
};

const LAYER_X_GAP = 600;
const LAYER_Y_GAP = 280;
const DEPTH_X_OFFSET = 28;
const JITTER_X_RANGE = 48;
const JITTER_Y_RANGE = 60;
const CHILD_LANE_SPACING = 1.15;
const MIN_LANE_GAP = 0.9;

const IconButtonPlus = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IconButtonEdit = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15.5 5.5L18.5 8.5M4 20l2.9-.4L18.5 8.5l-3-3L4 17z" />
  </svg>
);

const IconButtonSend = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 12L20 5l-5 14-3-6-6-1z" />
  </svg>
);

const hashNodeId = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return hash >>> 0;
};

const createNodePosition = (
  depth: number,
  lanePosition: number,
  nodeId: string,
) => {
  const hash = hashNodeId(nodeId);
  const xNoise = ((hash & 0xffff) / 0xffff - 0.5) * JITTER_X_RANGE;
  const yNoise =
    (((hash >> 16) & 0xffff) / 0xffff - 0.5) * JITTER_Y_RANGE;

  return {
    x: depth * LAYER_X_GAP + depth * DEPTH_X_OFFSET + xNoise,
    y: lanePosition * LAYER_Y_GAP + yNoise,
  };
};

const reserveLane = (
  depth: number,
  desiredLane: number,
  ctx: BuildContext,
): number => {
  if (!ctx.layerOccupancy[depth]) {
    ctx.layerOccupancy[depth] = [];
  }
  const lanes = ctx.layerOccupancy[depth];
  const isAvailable = (candidate: number) =>
    lanes.every((lane) => Math.abs(lane - candidate) >= MIN_LANE_GAP);

  if (isAvailable(desiredLane)) {
    lanes.push(desiredLane);
    return desiredLane;
  }

  let offsetStep = 1;
  while (offsetStep < 100) {
    const negative = desiredLane - offsetStep * MIN_LANE_GAP;
    if (isAvailable(negative)) {
      lanes.push(negative);
      return negative;
    }
    const positive = desiredLane + offsetStep * MIN_LANE_GAP;
    if (isAvailable(positive)) {
      lanes.push(positive);
      return positive;
    }
    offsetStep += 1;
  }

  lanes.push(desiredLane);
  return desiredLane;
};

const registerExistingLane = (
  depth: number,
  lane: number,
  ctx: BuildContext,
) => {
  if (!ctx.layerOccupancy[depth]) {
    ctx.layerOccupancy[depth] = [lane];
    return lane;
  }
  const lanes = ctx.layerOccupancy[depth];
  if (!lanes.some((existing) => Math.abs(existing - lane) < 1e-6)) {
    lanes.push(lane);
  }
  return lane;
};

const reserveLaneGroup = (
  depth: number,
  desiredLanes: number[],
  ctx: BuildContext,
): number[] => {
  if (desiredLanes.length === 0) {
    return [];
  }

  if (!ctx.layerOccupancy[depth]) {
    ctx.layerOccupancy[depth] = [];
  }

  const lanes = ctx.layerOccupancy[depth];
  const isAvailable = (positions: number[]) =>
    positions.every((position) =>
      lanes.every((lane) => Math.abs(lane - position) >= MIN_LANE_GAP),
    );

  if (isAvailable(desiredLanes)) {
    lanes.push(...desiredLanes);
    return desiredLanes;
  }

  let offsetStep = 1;
  while (offsetStep < 200) {
    const offset = offsetStep * MIN_LANE_GAP;
    const negative = desiredLanes.map((lane) => lane - offset);
    if (isAvailable(negative)) {
      lanes.push(...negative);
      return negative;
    }
    const positive = desiredLanes.map((lane) => lane + offset);
    if (isAvailable(positive)) {
      lanes.push(...positive);
      return positive;
    }
    offsetStep += 1;
  }

  lanes.push(...desiredLanes);
  return desiredLanes;
};

const traverseTree = (
  item: BranchNode,
  depth: number,
  lanePosition: number,
  sessionId: string,
  ctx: BuildContext,
  parentId: string | null,
  handlers: Pick<
    BranchingCanvasProps,
    "onSubmitPrompt" | "onSpecifyPrompt"
  >,
) => {
  const overrideLane = ctx.nodeLaneOverrides[item.id];
  const alignedLane =
    overrideLane !== undefined
      ? registerExistingLane(depth, overrideLane, ctx)
      : reserveLane(depth, lanePosition, ctx);
  if (overrideLane !== undefined) {
    delete ctx.nodeLaneOverrides[item.id];
  }

  ctx.nodes.push({
    id: item.id,
    type: "branch-node",
    position: createNodePosition(depth, alignedLane, item.id),
    data: {
      sessionId,
      node: item,
      parentId,
      onSubmitPrompt: handlers.onSubmitPrompt,
      onSpecifyPrompt: handlers.onSpecifyPrompt,
    },
  });

  const childCount = item.children.length;
  const desiredChildLanes = item.children.map((_, index) => {
    const offset =
      childCount > 0
        ? (index - (childCount - 1) / 2) * CHILD_LANE_SPACING
        : 0;
    return alignedLane + offset;
  });
  const resolvedChildLanes = reserveLaneGroup(
    depth + 1,
    desiredChildLanes,
    ctx,
  );

  item.children.forEach((child, index) => {
    const childLane = resolvedChildLanes[index] ?? alignedLane;
    ctx.nodeLaneOverrides[child.id] = childLane;

    ctx.edges.push({
      id: `${item.id}=>${child.id}`,
      source: item.id,
      target: child.id,
      type: "bezier",
    });
    traverseTree(
      child,
      depth + 1,
      childLane,
      sessionId,
      ctx,
      item.id,
      handlers,
    );
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
    layerOccupancy: {},
    nodeLaneOverrides: {},
  };

  traverseTree(session.root, 0, 0, session.id, ctx, null, handlers);

  return { nodes: ctx.nodes, edges: ctx.edges };
};

const BranchNodeRenderer = ({ data }: NodeProps<BranchNodeData>) => {
  const { node, parentId, sessionId, onSubmitPrompt, onSpecifyPrompt } = data;
  const [isEditing, setIsEditing] = useState(() => {
    if (node.variant === "specify") {
      return true;
    }
    if (node.variant === "prompt" && node.prompt.length === 0 && parentId === null) {
      return true;
    }
    return false;
  });
  const [draftPrompt, setDraftPrompt] = useState(node.prompt.trimStart());

  useEffect(() => {
    setDraftPrompt(node.prompt.trimStart());
  }, [node.prompt]);

  useEffect(() => {
    if (node.variant === "specify") {
      setIsEditing(true);
    }
  }, [node.variant]);

  useEffect(() => {
    if (
      node.variant === "prompt"
      && node.prompt.length === 0
      && parentId === null
    ) {
      setIsEditing(true);
    }
  }, [node.prompt, node.variant, parentId]);

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
    setIsEditing(false);
  };

  const isSpecify = node.variant === "specify";
  const isLoading = node.status === "loading";
  const isError = node.status === "error";
  const isOption = node.variant === "option";
  const displayPrompt = node.prompt.trimStart();
  const hasPrompt = displayPrompt.length > 0;
  const showTitle = isOption && node.title;
  const hasChildren = node.children.length > 0;
  const hasTitle = Boolean(node.title?.trim());
  const specifyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const optionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isPromptNode = !isSpecify && !isOption;

  const adjustTextareaHeight = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) {
      return;
    }
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (isSpecify) {
      adjustTextareaHeight(specifyTextareaRef.current);
    }
  }, [isSpecify, draftPrompt, adjustTextareaHeight]);

  useEffect(() => {
    if (isEditing && isOption) {
      adjustTextareaHeight(optionTextareaRef.current);
    }
  }, [isEditing, isOption, draftPrompt, adjustTextareaHeight]);

  useEffect(() => {
    if (isEditing && isPromptNode) {
      adjustTextareaHeight(promptTextareaRef.current);
    }
  }, [isEditing, isPromptNode, draftPrompt, adjustTextareaHeight]);

  const showLoadingOverlay = isLoading;

  const handleTextareaKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key === "Enter"
        && !event.shiftKey
        && !event.nativeEvent.isComposing
      ) {
        event.preventDefault();
        event.currentTarget.form?.requestSubmit();
      }
    },
    [],
  );

  return (
    <CanvasBlock
      className={`w-72 min-w-[18rem]${
        isOption && !isEditing ? " cursor-pointer" : ""
      }`}
    >
      {parentId ? (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !bg-[color:var(--color-accent)]"
        />
      ) : null}
      {node.variant !== "specify" && hasChildren ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !bg-[color:var(--color-accent)]"
        />
      ) : null}

      <div className="relative">
        <div className="flex flex-col gap-3">
          {isOption ? (
            <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {showTitle ? (
                  <h3 className="text-lg font-semibold tracking-tight text-[color:var(--color-foreground-strong)]">
                    {node.title}
                  </h3>
                ) : null}
              </div>
              {!isEditing ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsEditing(true);
                      setDraftPrompt(node.prompt.trimStart());
                    }}
                    className="inline-flex items-center justify-center rounded-full p-2 text-[color:var(--color-accent)] hover:opacity-80 disabled:opacity-50"
                    aria-label={hasPrompt ? "Edit prompt" : "Add prompt"}
                  >
                    {hasPrompt ? <IconButtonEdit /> : <IconButtonPlus />}
                    <span className="sr-only">
                      {hasPrompt ? "Edit prompt" : "Add prompt"}
                    </span>
                  </button>
                </div>
              ) : null}
            </div>

            {isEditing ? (
              <form
                onSubmit={handleSubmit}
                onClick={(event) => event.stopPropagation()}
                className="flex flex-col gap-2"
              >
                <div className="relative">
                  <textarea
                    ref={isOption ? optionTextareaRef : undefined}
                    rows={1}
                    value={draftPrompt}
                    onChange={(event) => {
                      setDraftPrompt(event.target.value);
                      adjustTextareaHeight(event.currentTarget);
                    }}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder="Add a prompt to shape this branch..."
                    className="min-h-0 w-full resize-none overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] py-3 pl-4 pr-12 text-sm text-[color:var(--color-foreground-muted)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)] focus:ring-opacity-40"
                  />
                  <button
                    type="submit"
                    className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--color-accent)] hover:opacity-80 disabled:opacity-50"
                    aria-label="Send prompt"
                    disabled={isLoading}
                  >
                    <IconButtonSend />
                    <span className="sr-only">Send</span>
                  </button>
                </div>
              </form>
            ) : hasPrompt ? (
              <>
                <p className="text-sm leading-relaxed text-[color:var(--color-foreground-muted)]">
                  {displayPrompt}
                </p>
              </>
            ) : null}
          </>
        ) : null}

        {isSpecify ? (
          <form
            onSubmit={handleSpecify}
            onClick={(event) => event.stopPropagation()}
            className="flex flex-col gap-2"
          >
            <div className="relative">
              <textarea
                value={draftPrompt}
                onChange={(event) => {
                  setDraftPrompt(event.target.value);
                  adjustTextareaHeight(event.currentTarget);
                }}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Specify"
                ref={isSpecify ? specifyTextareaRef : undefined}
                rows={1}
                className="min-h-0 w-full resize-none overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] py-2 pl-3 pr-12 text-sm text-[color:var(--color-foreground-muted)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)] focus:ring-opacity-40"
              />
              <button
                type="submit"
                className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--color-accent)] hover:opacity-80"
                aria-label="Send specify prompt"
              >
                <IconButtonSend />
                <span className="sr-only">Send specify prompt</span>
              </button>
            </div>
          </form>
        ) : null}

        {!isSpecify && !isOption ? (
          isEditing ? (
            <form
              onSubmit={handleSubmit}
              onClick={(event) => event.stopPropagation()}
              className="flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {node.title ? (
                    <h3 className="text-lg font-semibold tracking-tight text-[color:var(--color-foreground-strong)]">
                      {node.title}
                    </h3>
                  ) : null}
                </div>
              </div>
              <div className="relative">
                <textarea
                  ref={isPromptNode ? promptTextareaRef : undefined}
                  rows={1}
                  value={draftPrompt}
                  onChange={(event) => {
                    setDraftPrompt(event.target.value);
                    adjustTextareaHeight(event.currentTarget);
                  }}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Describe what you want to explore..."
                  className="min-h-0 w-full resize-none overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] py-3 pl-4 pr-12 text-sm text-[color:var(--color-foreground-muted)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)] focus:ring-opacity-40"
                />
                <button
                  type="submit"
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--color-accent)] hover:opacity-80 disabled:opacity-50"
                  aria-label="Send prompt"
                  disabled={isLoading}
                >
                  <IconButtonSend />
                  <span className="sr-only">Send</span>
                </button>
              </div>
            </form>
          ) : hasTitle ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold tracking-tight text-[color:var(--color-foreground-strong)]">
                    {node.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsEditing(true);
                    }}
                    className="inline-flex items-center justify-center rounded-full p-2 text-[color:var(--color-accent)] hover:opacity-80"
                    aria-label="Edit prompt"
                  >
                    <IconButtonEdit />
                    <span className="sr-only">Edit prompt</span>
                  </button>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-[color:var(--color-foreground-muted)]">
                {displayPrompt}
              </p>
            </>
          ) : (
            <div className="relative">
              <div className="absolute right-0 top-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsEditing(true);
                  }}
                  className="inline-flex items-center justify-center rounded-full pr-1 text-[color:var(--color-accent)] hover:opacity-80"
                  aria-label="Edit prompt"
                >
                  <IconButtonEdit />
                  <span className="sr-only">Edit prompt</span>
                </button>
              </div>
              <p className="pr-12 text-sm leading-relaxed text-[color:var(--color-foreground-muted)]">
                {displayPrompt}
              </p>
            </div>
          )
        ) : null}

          {isError && !isEditing ? (
            <div className="flex items-start justify-between gap-3 rounded-[var(--radius-card)] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              <span className="leading-relaxed">
                Generation failed. Try refining the prompt and resubmitting.
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsEditing(true);
                }}
                className="shrink-0 rounded-full border border-rose-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600 hover:bg-rose-100/60"
              >
                Retry
              </button>
            </div>
          ) : null}
        </div>
        {showLoadingOverlay ? (
          <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[var(--radius-block)]">
            <div className="loading-shimmer h-full w-full" />
          </div>
        ) : null}
      </div>
    </CanvasBlock>
  );
};

const nodeTypes = { "branch-node": BranchNodeRenderer };

export function BranchingCanvas({
  session,
  onSubmitPrompt,
  onSpecifyPrompt,
  onExpandOption,
}: BranchingCanvasProps) {
  const elements = useMemo(() => {
    if (!session) {
      return { nodes: [], edges: [] };
    }
    return buildFlowStructure(session, {
      onSubmitPrompt,
      onSpecifyPrompt,
    });
  }, [session, onSubmitPrompt, onSpecifyPrompt]);

  const handleNodeClick = useCallback(
    (_event: unknown, nodeInstance: Node<BranchNodeData>) => {
      const data = nodeInstance.data;
      if (!data || data.node.variant !== "option") {
        return;
      }
      if (data.node.status === "loading") {
        return;
      }
      void onExpandOption(data.sessionId, data.node.id);
    },
    [onExpandOption],
  );

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[color:var(--color-foreground-soft)]">
        Select a session to view its tree.
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="h-full w-full">
        <ReactFlow
          className="h-full w-full"
          proOptions={{ hideAttribution: true }}
          fitView
          minZoom={0.1}
          nodes={elements.nodes}
          edges={elements.edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          defaultEdgeOptions={{
            style: { stroke: "rgba(96,96,96,0.45)", strokeWidth: 2 },
          }}
          connectionLineStyle={{
            stroke: "rgba(120,120,120,0.55)",
            strokeWidth: 2,
          }}
          panOnScroll
        >
          <Background gap={24} color="rgba(140,140,140,0.12)" />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
