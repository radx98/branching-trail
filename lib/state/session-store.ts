'use client';

import { create } from "zustand";

import type { BranchNode, SessionTree } from "@/lib/types/tree";
import { createSpecifyNode } from "@/lib/tree/builders";

type SessionState = {
  sessions: SessionTree[];
  activeSessionId: string | null;
  isHydrating: boolean;
  hasHydrated: boolean;
  lastError: string | null;
  createSession: () => void;
  selectSession: (sessionId: string) => void;
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
  hydrate: () => Promise<void>;
  clearError: () => void;
};

const EMPTY_STATE_NOTE =
  "Create a fresh session to start exploring branching ideas.";

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

const findSessionIndex = (sessions: SessionTree[], sessionId: string) =>
  sessions.findIndex((session) => session.id === sessionId);

const createPlaceholderSession = (): SessionTree => {
  const sessionId = `draft-${crypto.randomUUID()}`;
  const rootId = `${sessionId}::root`;

  return {
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
};

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
}

async function requestJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  let data: unknown = null;
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    try {
      data = await response.json();
    } catch (error) {
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

type ApiResponse<T> = T & {
  meta?: {
    backend?: "supabase" | "memory";
    lastError?: string | null;
  };
};

const logStorageWarning = (meta?: ApiResponse<unknown>["meta"]) => {
  if (!meta) {
    return;
  }
  if (meta.backend === "memory") {
    console.warn(
      "[sessions] Using in-memory session store. Supabase writes are disabled",
      meta.lastError ? `(${meta.lastError})` : "",
    );
  }
};

const getJson = <T,>(url: string) =>
  requestJson<ApiResponse<T>>(url, { method: "GET" });

const postJson = <T,>(url: string, body: unknown) =>
  requestJson<ApiResponse<T>>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isHydrating: false,
  hasHydrated: false,
  lastError: null,
  createSession: () => {
    const session = createPlaceholderSession();
    set((state) => ({
      ...state,
      sessions: [session, ...state.sessions],
      activeSessionId: session.id,
      lastError: null,
    }));
  },
  selectSession: (sessionId: string) =>
    set((state) => ({
      ...state,
      activeSessionId: sessionId,
    })),
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
      const data = await getJson<{ sessions: SessionTree[] }>("/api/sessions");
      logStorageWarning(data.meta);
      const sessions = (data.sessions ?? []).map((session) => ({
        ...session,
        isPlaceholder: false,
      }));

      set((state) => {
        const currentActive = state.activeSessionId;
        const activeSession =
          currentActive && sessions.some((item) => item.id === currentActive)
            ? currentActive
            : sessions[0]?.id ?? currentActive;

        return {
          ...state,
          sessions,
          activeSessionId: activeSession,
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
    const sessionIndex = findSessionIndex(state.sessions, sessionId);
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
        const data = await postJson<{ session: SessionTree }>(
          "/api/sessions",
          { prompt },
        );
        logStorageWarning(data.meta);
        const createdSession: SessionTree = {
          ...data.session,
          isPlaceholder: false,
        };

        set((current) => {
          const sessions = current.sessions.slice();
          sessions[sessionIndex] = createdSession;
          return {
            ...current,
            sessions,
            activeSessionId: createdSession.id,
          };
        });
      } else {
        const data = await postJson<{ session: SessionTree }>(
          `/api/tree/${session.id}/expand`,
          { mode: "submit", nodeId, prompt },
        );
        logStorageWarning(data.meta);
        const updatedSession: SessionTree = {
          ...data.session,
          isPlaceholder: false,
        };

        set((current) => {
          const sessions = current.sessions.slice();
          sessions[sessionIndex] = updatedSession;
          return {
            ...current,
            sessions,
          };
        });
      }
    } catch (error) {
      console.error("Failed to submit prompt", error);
      set((current) => {
        const sessions = current.sessions.slice();
        sessions[sessionIndex] = {
          ...snapshot,
          root: updateNode(snapshot.root, nodeId, (node) => ({
            ...node,
            prompt,
            status: "error",
          })),
        };

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
    const sessionIndex = findSessionIndex(state.sessions, sessionId);
    if (sessionIndex === -1) {
      return;
    }

    const session = state.sessions[sessionIndex];
    if (session.isPlaceholder) {
      return;
    }

    const snapshot = cloneSessionTree(session);
    const tempNodeId = `${parentNodeId}::temp-${crypto.randomUUID()}`;

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
      const data = await postJson<{ session: SessionTree }>(
        `/api/tree/${session.id}/expand`,
        { mode: "specify", parentNodeId, prompt },
      );
      logStorageWarning(data.meta);
      const updatedSession: SessionTree = {
        ...data.session,
        isPlaceholder: false,
      };

      set((current) => {
        const sessions = current.sessions.slice();
        sessions[sessionIndex] = updatedSession;
        return {
          ...current,
          sessions,
        };
      });
    } catch (error) {
      console.error("Failed to create specify prompt", error);
      set((current) => {
        const sessions = current.sessions.slice();
        sessions[sessionIndex] = {
          ...snapshot,
          root: updateNode(snapshot.root, parentNodeId, (node) => ({
            ...node,
            status: "error",
          })),
        };

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
}));

export { EMPTY_STATE_NOTE };
