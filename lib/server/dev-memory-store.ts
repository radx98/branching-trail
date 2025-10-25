import { randomUUID } from "node:crypto";

import type { BranchNode } from "@/lib/types/tree";
import type { SessionRow } from "@/lib/server/session-repository";

type MemorySessionRow = SessionRow & {
  created_at: number;
};

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

const ensureUserStore = (
  userId: string,
): Map<string, MemorySessionRow> => {
  if (!sessionsByUser.has(userId)) {
    sessionsByUser.set(userId, new Map());
  }
  return sessionsByUser.get(userId)!;
};

export function memoryListSessions(userId: string): SessionRow[] {
  const store = sessionsByUser.get(userId);
  if (!store) {
    return [];
  }

  return Array.from(store.values())
    .sort((a, b) => b.created_at - a.created_at)
    .map(cloneRow);
}

export function memoryInsertSession(
  userId: string,
  payload: {
    title: string;
    tree: BranchNode;
    tokenUsage: number;
  },
): SessionRow {
  const store = ensureUserStore(userId);
  const id = `local-${randomUUID()}`;

  const row: MemorySessionRow = {
    id,
    user_id: userId,
    title: payload.title,
    tree_json: cloneTree(payload.tree),
    token_usage: payload.tokenUsage,
    created_at: Date.now(),
  };

  store.set(id, row);
  return cloneRow(row);
}

export function memoryFetchSession(
  userId: string,
  sessionId: string,
): SessionRow {
  const store = sessionsByUser.get(userId);
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
  userId: string,
  sessionId: string,
  payload: {
    title?: string;
    tree: BranchNode;
    tokenUsage: number;
  },
): SessionRow {
  const store = sessionsByUser.get(userId);
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

export function memoryDeleteSession(
  userId: string,
  sessionId: string,
): void {
  const store = sessionsByUser.get(userId);
  if (!store) {
    throw new Error("Session not found.");
  }

  if (!store.delete(sessionId)) {
    throw new Error("Session not found.");
  }
}
