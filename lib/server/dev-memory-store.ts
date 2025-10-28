import { randomUUID } from "node:crypto";

import type { BranchNode } from "@/lib/types/tree";
import type { SessionRow } from "@/lib/server/session-repository";

type MemorySessionRow = SessionRow & {
  created_at: number;
};

const PUBLIC_USER_ID =
  process.env.BRANCHING_TRAIL_SESSION_USER_ID ?? "public-user";
const sessionsByUser = new Map<string, Map<string, MemorySessionRow>>();

const cloneTree = (tree: BranchNode): BranchNode =>
  JSON.parse(JSON.stringify(tree)) as BranchNode;

const cloneRow = (row: MemorySessionRow): SessionRow => ({
  id: row.id,
  user_id: row.user_id,
  title: row.title,
  tree_json: cloneTree(row.tree_json),
  token_usage: row.token_usage,
});

const ensureUserStore = (): Map<string, MemorySessionRow> => {
  if (!sessionsByUser.has(PUBLIC_USER_ID)) {
    sessionsByUser.set(PUBLIC_USER_ID, new Map());
  }
  return sessionsByUser.get(PUBLIC_USER_ID)!;
};

export function memoryListSessions(): SessionRow[] {
  const store = sessionsByUser.get(PUBLIC_USER_ID);
  if (!store) {
    return [];
  }

  return Array.from(store.values())
    .sort((a, b) => b.created_at - a.created_at)
    .map(cloneRow);
}

export function memoryInsertSession(payload: {
  title: string;
  tree: BranchNode;
  tokenUsage: number;
}): SessionRow {
  const store = ensureUserStore();
  const id = `local-${randomUUID()}`;

  const row: MemorySessionRow = {
    id,
    user_id: PUBLIC_USER_ID,
    title: payload.title,
    tree_json: cloneTree(payload.tree),
    token_usage: payload.tokenUsage,
    created_at: Date.now(),
  };

  store.set(id, row);
  return cloneRow(row);
}

export function memoryFetchSession(sessionId: string): SessionRow {
  const store = sessionsByUser.get(PUBLIC_USER_ID);
  if (!store) {
    throw new Error("Session not found.");
  }

  const row = store.get(sessionId);
  if (!row) {
    throw new Error("Session not found.");
  }

  return cloneRow(row);
}

export function memoryUpdateSession(
  sessionId: string,
  payload: {
    title?: string;
    tree: BranchNode;
    tokenUsage: number;
  },
): SessionRow {
  const store = sessionsByUser.get(PUBLIC_USER_ID);
  if (!store) {
    throw new Error("Session not found.");
  }

  const existing = store.get(sessionId);
  if (!existing) {
    throw new Error("Session not found.");
  }

  const updated: MemorySessionRow = {
    ...existing,
    title: payload.title ?? existing.title,
    tree_json: cloneTree(payload.tree),
    token_usage: payload.tokenUsage,
  };

  store.set(sessionId, updated);
  return cloneRow(updated);
}

export function memoryDeleteSession(sessionId: string): void {
  const store = sessionsByUser.get(PUBLIC_USER_ID);
  if (!store) {
    throw new Error("Session not found.");
  }

  if (!store.delete(sessionId)) {
    throw new Error("Session not found.");
  }
}
