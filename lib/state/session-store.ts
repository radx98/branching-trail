'use client';

import { create } from "zustand";

export type BranchNodeVariant = "prompt" | "option" | "specify";
export type BranchNodeStatus = "idle" | "loading" | "error";

export interface BranchNode {
  id: string;
  title: string;
  prompt: string;
  variant: BranchNodeVariant;
  status: BranchNodeStatus;
  children: BranchNode[];
}

export interface SessionTree {
  id: string;
  title: string;
  isPlaceholder: boolean;
  root: BranchNode;
}

type SessionState = {
  sessions: SessionTree[];
  activeSessionId: string | null;
  createSession: () => void;
  selectSession: (sessionId: string) => void;
  submitPrompt: (sessionId: string, nodeId: string, prompt: string) => void;
  commitSpecifyPrompt: (
    sessionId: string,
    parentNodeId: string,
    prompt: string,
  ) => void;
};

const MOCK_OPTION_SETS = [
  [
    "Strategy & Simulation Focus",
    "Action & Adventure Beats",
    "Puzzle & Logic Paths",
    "Story & Roleplay Hooks",
  ],
  [
    "Audience Personas",
    "Core Loop Variations",
    "Monetization Scenarios",
    "Retention Experiments",
  ],
  [
    "Visual Moodboards",
    "Systems & Mechanics",
    "Narrative Branches",
    "Market Positioning",
  ],
  [
    "Launch Roadmap",
    "Content Update Ideas",
    "Community Programs",
    "Tech Stack Notes",
  ],
] as const;

const MOCK_PROMPT_SEEDS = [
  "Lean into repeatable loops that encourage tinkering.",
  "Highlight high-sensation moments and reactive controls.",
  "Design clever twists that reward insight and pattern spotting.",
  "Focus on character arcs and emergent storytelling avenues.",
] as const;

const MOCK_PLACEHOLDER_NOTE =
  "Placeholder dataset for Phase 2. Replace with API-backed data in Phase 3.";

const createSpecifyNode = (parentId: string): BranchNode => ({
  id: `${parentId}::specify`,
  title: "Specify",
  prompt: "",
  variant: "specify",
  status: "idle",
  children: [],
});

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charCodeAt(index);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
};

const buildMockChildren = (
  node: BranchNode,
  depth: number,
): BranchNode[] => {
  const seed = hashString(node.id) + depth;
  const optionSet = MOCK_OPTION_SETS[seed % MOCK_OPTION_SETS.length];
  const promptSeed =
    MOCK_PROMPT_SEEDS[(seed + depth) % MOCK_PROMPT_SEEDS.length];

  const options = optionSet.map((title, index) => ({
    id: `${node.id}::opt-${index + 1}`,
    title,
    prompt: "",
    variant: "option" as const,
    status: "idle" as const,
    children: [],
  }));

  if (node.variant !== "specify") {
    return [...options, createSpecifyNode(node.id)];
  }

  return options.map((option, idx) => ({
    ...option,
    prompt: idx === 0 ? promptSeed : "",
  }));
};

const cloneNode = (node: BranchNode): BranchNode => ({
  ...node,
  children: node.children.map(cloneNode),
});

const updateNode = (
  node: BranchNode,
  nodeId: string,
  updater: (current: BranchNode) => BranchNode,
): BranchNode => {
  if (node.id === nodeId) {
    return updater(node);
  }
  return {
    ...node,
    children: node.children.map((child) => updateNode(child, nodeId, updater)),
  };
};

const findNode = (
  node: BranchNode,
  nodeId: string,
): { node: BranchNode; depth: number } | null => {
  if (node.id === nodeId) {
    return { node, depth: 0 };
  }
  for (const child of node.children) {
    const found = findNode(child, nodeId);
    if (found) {
      return { node: found.node, depth: found.depth + 1 };
    }
  }
  return null;
};

const scheduleMockExpansion = (
  setState: (
    partial:
      | SessionState
      | Partial<SessionState>
      | ((state: SessionState) => SessionState | Partial<SessionState>),
    replace?: boolean,
  ) => void,
  getState: () => SessionState,
  sessionId: string,
  nodeId: string,
) => {
  const session = getState().sessions.find((item) => item.id === sessionId);
  if (!session) {
    return;
  }

  const match = findNode(session.root, nodeId);
  if (!match) {
    return;
  }

  const depth = match.depth;
  const { node } = match;

  setState((state) => ({
    ...state,
    sessions: state.sessions.map((item) =>
      item.id === sessionId
        ? {
            ...item,
            root: updateNode(item.root, nodeId, (current) => ({
              ...current,
              status: "loading",
              children: [],
            })),
          }
        : item,
    ),
  }));

  const children = buildMockChildren(node, depth);

  setTimeout(() => {
    setState((state) => ({
      ...state,
      sessions: state.sessions.map((item) =>
        item.id === sessionId
          ? {
              ...item,
              root: updateNode(item.root, nodeId, (current) => ({
                ...current,
                status: "idle",
                children,
              })),
            }
          : item,
      ),
    }));
  }, 650);
};

const createEmptySession = (): SessionTree => {
  const sessionId = crypto.randomUUID();
  const rootId = `${sessionId}::root`;

  return {
    id: sessionId,
    title: "New session",
    isPlaceholder: true,
    root: {
      id: rootId,
      title: "New session",
      prompt: "",
      variant: "prompt",
      status: "idle",
      children: [],
    },
  };
};

const initialSessions: SessionTree[] = [
  {
    id: "session-browser-game",
    title: "Indie Browser Game Explorer",
    isPlaceholder: true,
    root: {
      id: "session-browser-game::root",
      title: "Indie Browser Game Explorer",
      prompt:
        "Explore what makes a standout browser-based game for a small team.",
      variant: "prompt",
      status: "idle",
      children: [
        {
          id: "session-browser-game::root::opt-1",
          title: "Strategy & Simulation Focus",
          prompt: "",
          variant: "option",
          status: "idle",
          children: [],
        },
        {
          id: "session-browser-game::root::opt-2",
          title: "Action & Adventure Beats",
          prompt: "",
          variant: "option",
          status: "idle",
          children: [],
        },
        {
          id: "session-browser-game::root::opt-3",
          title: "Puzzle & Logic Paths",
          prompt: "",
          variant: "option",
          status: "idle",
          children: [],
        },
        {
          id: "session-browser-game::root::opt-4",
          title: "Story & Roleplay Hooks",
          prompt: "",
          variant: "option",
          status: "idle",
          children: [],
        },
        createSpecifyNode("session-browser-game::root"),
      ],
    },
  },
  {
    id: "session-new-product",
    title: "Concept Discovery Playground",
    isPlaceholder: true,
    root: {
      id: "session-new-product::root",
      title: "Concept Discovery Playground",
      prompt: "Map fresh product concepts for hybrid productivity tools.",
      variant: "prompt",
      status: "idle",
      children: [
        {
          id: "session-new-product::root::opt-1",
          title: "Audience Personas",
          prompt: "",
          variant: "option",
          status: "idle",
          children: [],
        },
        {
          id: "session-new-product::root::opt-2",
          title: "Core Loop Variations",
          prompt: "",
          variant: "option",
          status: "idle",
          children: [],
        },
        {
          id: "session-new-product::root::opt-3",
          title: "Monetization Scenarios",
          prompt: "",
          variant: "option",
          status: "idle",
          children: [],
        },
        {
          id: "session-new-product::root::opt-4",
          title: "Retention Experiments",
          prompt: "",
          variant: "option",
          status: "idle",
          children: [],
        },
        createSpecifyNode("session-new-product::root"),
      ],
    },
  },
].map((session) => ({ ...session, root: cloneNode(session.root) }));

const normaliseSessionTitle = (prompt: string): string => {
  if (!prompt.trim()) {
    return "New session";
  }
  const trimmed = prompt.trim();
  const words = trimmed.split(/\s+/).slice(0, 6);
  return words
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
};

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: initialSessions,
  activeSessionId: initialSessions[0]?.id ?? null,
  createSession: () => {
    const session = createEmptySession();
    set((state) => ({
      ...state,
      sessions: [session, ...state.sessions],
      activeSessionId: session.id,
    }));
  },
  selectSession: (sessionId: string) =>
    set((state) => ({
      ...state,
      activeSessionId: sessionId,
    })),
  submitPrompt: (sessionId, nodeId, prompt) => {
    const state = get();
    const session = state.sessions.find((item) => item.id === sessionId);
    if (!session) {
      return;
    }

    const updatedSessions = state.sessions.map((item) =>
      item.id === sessionId
        ? {
            ...item,
            title:
              item.root.id === nodeId
                ? normaliseSessionTitle(prompt)
                : item.title,
            root: updateNode(item.root, nodeId, (current) => ({
              ...current,
              prompt,
              title:
                current.variant === "prompt" && current.title === "New session"
                  ? normaliseSessionTitle(prompt)
                  : current.title,
            })),
          }
        : item,
    );

    set({ ...state, sessions: updatedSessions });

    scheduleMockExpansion(set, get, sessionId, nodeId);
  },
  commitSpecifyPrompt: (sessionId, parentNodeId, prompt) => {
    const state = get();
    const session = state.sessions.find((item) => item.id === sessionId);
    if (!session) {
      return;
    }

    const newNode: BranchNode = {
      id: `${parentNodeId}::spec-${crypto.randomUUID()}`,
      title: "",
      prompt,
      variant: "prompt",
      status: "loading",
      children: [],
    };

    const sessionsWithSpecify = state.sessions.map((item) =>
      item.id === sessionId
        ? {
            ...item,
            root: updateNode(item.root, parentNodeId, (current) => ({
              ...current,
              children: [
                ...current.children
                  .filter((child) => child.variant !== "specify"),
                newNode,
                createSpecifyNode(parentNodeId),
              ],
            })),
          }
        : item,
    );

    set({ ...state, sessions: sessionsWithSpecify });

    scheduleMockExpansion(set, get, sessionId, newNode.id);
  },
}));

export { MOCK_PLACEHOLDER_NOTE };
