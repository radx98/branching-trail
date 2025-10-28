'use client';

import { create } from "zustand";

import type { BranchNode, SessionTree } from "@/lib/types/tree";
import { createOptionNode, createSpecifyNode } from "@/lib/tree/builders";
import { findNodeWithTrail, walkTree, ensureSpecifyChild } from "@/lib/tree/operations";

type SessionState = {
  sessions: SessionTree[];
  activeSessionId: string | null;
  isHydrating: boolean;
  hasHydrated: boolean;
  lastError: string | null;
  createSession: () => void;
  selectSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  submitPrompt: (
    sessionId: string,
    nodeId: string,
    prompt: string,
  ) => Promise<void>;
  commitSpecifyPrompt: (
    sessionId: string,
    parentNodeId: string,
    prompt: string,
  ) => Promise<void>;
  expandOption: (sessionId: string, nodeId: string) => Promise<void>;
  hydrate: () => Promise<void>;
  clearError: () => void;
};

const EMPTY_STATE_NOTE =
  "Create a fresh session to start exploring branching ideas.";

const STORAGE_KEY = "branching-trail:sessions:v1";

const cloneSessionTree = (session: SessionTree): SessionTree =>
  JSON.parse(JSON.stringify(session)) as SessionTree;

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
    children: node.children.map((child) =>
      updateNode(child, nodeId, updater),
    ),
  };
};

const generateId = (prefix: string) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

const persistSessions = (sessions: SessionTree[]) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("Failed to persist sessions", error);
  }
};

const loadSessionsFromStorage = (): SessionTree[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as SessionTree[];
    return Array.isArray(parsed)
      ? parsed.map((session) => ({
          ...session,
          isPlaceholder: false,
        }))
      : [];
  } catch (error) {
    console.error("Failed to load stored sessions", error);
    return [];
  }
};

const buildOptionChildren = (parentId: string, options: string[]) => {
  const children = options.map((option, index) =>
    createOptionNode({ parentId, index, title: option }),
  );
  children.push(createSpecifyNode(parentId));
  return children;
};

const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
};

async function requestJson<T>(
  url: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let data: unknown = null;

  if (response.headers.get("content-type")?.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      typeof (data as { error?: string } | null)?.error === "string"
        ? (data as { error?: string }).error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return (data ?? {}) as T;
}

type OptionsResponse = {
  options: string[];
  tokens: number;
};

type TitleResponse = {
  title: string;
  tokens: number;
};

const fetchBranchOptions = (payload: {
  prompt: string;
  nodeTitle?: string;
  breadcrumb?: string[];
}): Promise<OptionsResponse> =>
  requestJson<OptionsResponse>("/api/generate/options", payload);

const fetchSessionTitle = (prompt: string): Promise<TitleResponse> =>
  requestJson<TitleResponse>("/api/generate/title", { prompt });

const ensureSpecifyBranches = (root: BranchNode): BranchNode => {
  const clone = JSON.parse(JSON.stringify(root)) as BranchNode;
  walkTree(clone, (node) => ensureSpecifyChild(node, createSpecifyNode));
  return clone;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isHydrating: false,
  hasHydrated: false,
  lastError: null,
  createSession: () => {
    const sessionId = generateId("draft");
    const rootId = `${sessionId}::root`;

    const session: SessionTree = {
      id: sessionId,
      title: "New session",
      isPlaceholder: true,
      tokenUsage: null,
      root: {
        id: rootId,
        title: "New session",
        prompt: "",
        variant: "prompt",
        status: "idle",
        children: [],
      },
    };

    set((state) => {
      const sessions = [session, ...state.sessions];
      persistSessions(sessions.filter((item) => !item.isPlaceholder));
      return {
        ...state,
        sessions,
        activeSessionId: session.id,
        lastError: null,
      };
    });
  },
  selectSession: (sessionId: string) =>
    set((state) => ({
      ...state,
      activeSessionId: sessionId,
    })),
  deleteSession: (sessionId) => {
    set((state) => {
      const sessions = state.sessions.filter((session) =>
        session.id !== sessionId,
      );
      persistSessions(sessions.filter((item) => !item.isPlaceholder));
      const activeSessionId =
        state.activeSessionId === sessionId
          ? sessions[0]?.id ?? null
          : state.activeSessionId;

      return {
        ...state,
        sessions,
        activeSessionId,
        lastError: null,
      };
    });
  },
  hydrate: async () => {
    const { hasHydrated, isHydrating } = get();
    if (hasHydrated || isHydrating) {
      return;
    }

    set((state) => ({
      ...state,
      isHydrating: true,
      lastError: null,
    }));

    try {
      const sessions = loadSessionsFromStorage();
      set((state) => {
        const active = state.activeSessionId && sessions.some((item) =>
          item.id === state.activeSessionId
        )
          ? state.activeSessionId
          : sessions[0]?.id ?? state.activeSessionId;

        return {
          ...state,
          sessions,
          activeSessionId: active,
          isHydrating: false,
          hasHydrated: true,
        };
      });
    } catch (error) {
      console.error("Failed to hydrate sessions", error);
      set((state) => ({
        ...state,
        isHydrating: false,
        lastError: extractErrorMessage(error, "Failed to load sessions."),
      }));
    }
  },
  clearError: () =>
    set((state) => ({
      ...state,
      lastError: null,
    })),
  submitPrompt: async (sessionId, nodeId, prompt) => {
    const state = get();
    const sessionIndex = state.sessions.findIndex((session) =>
      session.id === sessionId
    );
    if (sessionIndex === -1) {
      return;
    }

    const session = state.sessions[sessionIndex];
    const snapshot = cloneSessionTree(session);

    set((current) => {
      const sessions = current.sessions.slice();
      sessions[sessionIndex] = {
        ...sessions[sessionIndex],
        root: updateNode(sessions[sessionIndex].root, nodeId, (node) => ({
          ...node,
          prompt,
          status: "loading",
          children: [],
        })),
      };

      return {
        ...current,
        sessions,
        lastError: null,
      };
    });

    try {
      if (session.isPlaceholder) {
        const [titleResult, optionsResult] = await Promise.all([
          fetchSessionTitle(prompt),
          fetchBranchOptions({ prompt }),
        ]);

        const newSessionId = generateId("session");
        const rootId = `${newSessionId}::root`;

        const nextSession: SessionTree = {
          id: newSessionId,
          title: titleResult.title,
          isPlaceholder: false,
          tokenUsage: titleResult.tokens + optionsResult.tokens,
          root: {
            id: rootId,
            title: titleResult.title,
            prompt,
            variant: "prompt",
            status: "idle",
            children: buildOptionChildren(rootId, optionsResult.options),
          },
        };

        set((current) => {
          const sessions = current.sessions.slice();
          sessions[sessionIndex] = nextSession;
          persistSessions(sessions.filter((item) => !item.isPlaceholder));
          return {
            ...current,
            sessions,
            activeSessionId: nextSession.id,
          };
        });

        return;
      }

      const match = findNodeWithTrail(snapshot.root, nodeId);
      if (!match) {
        throw new Error("Target node not found.");
      }

      const breadcrumbTitles = match.breadcrumb
        .filter((node) => node.variant !== "specify")
        .map((node) => node.title)
        .filter((title): title is string => Boolean(title));

      const optionsResult = await fetchBranchOptions({
        prompt,
        nodeTitle: match.node.title,
        breadcrumb: breadcrumbTitles,
      });

      let updatedTitle: string | undefined;
      let accumulatedTokens = optionsResult.tokens;

      if (match.parent === null) {
        const titleResult = await fetchSessionTitle(prompt);
        updatedTitle = titleResult.title;
        accumulatedTokens += titleResult.tokens;
      }

      set((current) => {
        const sessions = current.sessions.slice();
        const target = sessions[sessionIndex];

        const updatedSession: SessionTree = {
          ...target,
          title: updatedTitle ?? target.title,
          tokenUsage:
            (target.tokenUsage ?? 0) + accumulatedTokens,
          root: ensureSpecifyBranches(
            updateNode(target.root, nodeId, (node) => ({
              ...node,
              prompt,
              title: match.parent === null && updatedTitle
                ? updatedTitle
                : node.title,
              status: "idle",
              children: buildOptionChildren(node.id, optionsResult.options),
            })),
          ),
        };

        sessions[sessionIndex] = updatedSession;
        persistSessions(sessions.filter((item) => !item.isPlaceholder));
        return {
          ...current,
          sessions,
        };
      });
    } catch (error) {
      console.error("Failed to submit prompt", error);
      set((current) => {
        const sessions = current.sessions.slice();
        sessions[sessionIndex] = snapshot;
        return {
          ...current,
          sessions,
          lastError: extractErrorMessage(
            error,
            "Failed to submit prompt. Please try again.",
          ),
        };
      });
    }
  },
  commitSpecifyPrompt: async (sessionId, parentNodeId, prompt) => {
    const state = get();
    const sessionIndex = state.sessions.findIndex((session) =>
      session.id === sessionId
    );
    if (sessionIndex === -1) {
      return;
    }

    const session = state.sessions[sessionIndex];
    if (session.isPlaceholder) {
      return;
    }

    const snapshot = cloneSessionTree(session);

    const tempNodeId = `${parentNodeId}::temp-${generateId("node")}`;

    set((current) => {
      const sessions = current.sessions.slice();
      sessions[sessionIndex] = {
        ...sessions[sessionIndex],
        root: updateNode(
          sessions[sessionIndex].root,
          parentNodeId,
          (node) => ({
            ...node,
            children: [
              ...node.children.filter((child) => child.variant !== "specify"),
              {
                id: tempNodeId,
                title: "",
                prompt,
                variant: "prompt",
                status: "loading",
                children: [],
              },
              createSpecifyNode(parentNodeId),
            ],
          }),
        ),
      };
      return {
        ...current,
        sessions,
        lastError: null,
      };
    });

    try {
      const parentMatch = findNodeWithTrail(snapshot.root, parentNodeId);
      if (!parentMatch) {
        throw new Error("Parent node not found.");
      }

      const breadcrumbTitles = [
        ...parentMatch.breadcrumb
          .filter((node) => node.variant !== "specify")
          .map((node) => node.title)
          .filter(Boolean),
        parentMatch.node.variant !== "specify" ? parentMatch.node.title : "",
      ].filter(Boolean);

      const optionsResult = await fetchBranchOptions({
        prompt,
        breadcrumb: breadcrumbTitles,
      });

      const newNodeId = `${parentNodeId}::spec-${generateId("node")}`;
      const newNode: BranchNode = {
        id: newNodeId,
        title: "",
        prompt,
        variant: "prompt",
        status: "idle",
        children: buildOptionChildren(newNodeId, optionsResult.options),
      };

      set((current) => {
        const sessions = current.sessions.slice();
        const target = sessions[sessionIndex];

        const updatedSession: SessionTree = {
          ...target,
          tokenUsage:
            (target.tokenUsage ?? 0) + optionsResult.tokens,
          root: ensureSpecifyBranches(
            updateNode(target.root, parentNodeId, (node) => ({
              ...node,
              children: [
                ...node.children.filter((child) => child.variant !== "specify"),
                newNode,
                createSpecifyNode(node.id),
              ],
            })),
          ),
        };

        sessions[sessionIndex] = updatedSession;
        persistSessions(sessions.filter((item) => !item.isPlaceholder));
        return {
          ...current,
          sessions,
        };
      });
    } catch (error) {
      console.error("Failed to create specify prompt", error);
      set((current) => {
        const sessions = current.sessions.slice();
        sessions[sessionIndex] = snapshot;
        return {
          ...current,
          sessions,
          lastError: extractErrorMessage(
            error,
            "Failed to extend branch. Please try again.",
          ),
        };
      });
    }
  },
  expandOption: async (sessionId, nodeId) => {
    const state = get();
    const sessionIndex = state.sessions.findIndex((session) =>
      session.id === sessionId
    );
    if (sessionIndex === -1) {
      return;
    }

    const session = state.sessions[sessionIndex];
    if (session.isPlaceholder) {
      return;
    }

    const snapshot = cloneSessionTree(session);

    set((current) => {
      const sessions = current.sessions.slice();
      sessions[sessionIndex] = {
        ...sessions[sessionIndex],
        root: updateNode(sessions[sessionIndex].root, nodeId, (node) => ({
          ...node,
          status: "loading",
          children: [],
        })),
      };
      return {
        ...current,
        sessions,
        lastError: null,
      };
    });

    try {
      const match = findNodeWithTrail(snapshot.root, nodeId);
      if (!match) {
        throw new Error("Target node not found.");
      }
      if (match.node.variant !== "option") {
        throw new Error("Only option nodes can be expanded.");
      }

      const optionPrompt = match.node.prompt.trim()
        || match.node.title.trim();
      if (!optionPrompt) {
        throw new Error("Option is missing prompt context.");
      }

      const breadcrumbTitles = match.breadcrumb
        .filter((node) => node.variant !== "specify")
        .map((node) =>
          node.variant === "prompt" && node.prompt
            ? node.prompt
            : node.title,
        )
        .filter((title): title is string => Boolean(title));

      if (match.node.title) {
        breadcrumbTitles.push(match.node.title);
      }

      const optionsResult = await fetchBranchOptions({
        prompt: optionPrompt,
        nodeTitle: match.node.title,
        breadcrumb: breadcrumbTitles,
      });

      set((current) => {
        const sessions = current.sessions.slice();
        const target = sessions[sessionIndex];

        const updatedSession: SessionTree = {
          ...target,
          tokenUsage:
            (target.tokenUsage ?? 0) + optionsResult.tokens,
          root: ensureSpecifyBranches(
            updateNode(target.root, nodeId, (node) => ({
              ...node,
              status: "idle",
              children: buildOptionChildren(node.id, optionsResult.options),
            })),
          ),
        };

        sessions[sessionIndex] = updatedSession;
        persistSessions(sessions.filter((item) => !item.isPlaceholder));
        return {
          ...current,
          sessions,
        };
      });
    } catch (error) {
      console.error("Failed to expand option", error);
      set((current) => {
        const sessions = current.sessions.slice();
        sessions[sessionIndex] = snapshot;
        return {
          ...current,
          sessions,
          lastError: extractErrorMessage(
            error,
            "Failed to expand option. Please try again.",
          ),
        };
      });
    }
  },
})); 

export { EMPTY_STATE_NOTE };
