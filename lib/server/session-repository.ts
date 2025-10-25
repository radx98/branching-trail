import type { SupabaseClient } from "@supabase/supabase-js";

import type { BranchNode, SessionTree } from "@/lib/types/tree";
import {
  memoryFetchSession,
  memoryInsertSession,
  memoryListSessions,
  memoryUpdateSession,
  memoryDeleteSession,
} from "@/lib/server/dev-memory-store";

export type SessionRow = {
  id: string;
  user_id: string;
  title: string;
  tree_json: BranchNode;
  token_usage: number | null;
};

const isDevEnvironment = process.env.NODE_ENV !== "production";
let memoryFallbackEnabled = false;
let diagnostics: {
  backend: "supabase" | "memory";
  lastError: string | null;
} = {
  backend: "supabase",
  lastError: null,
};

const shouldUseMemoryStore = (supabase: SupabaseClient | null) =>
  memoryFallbackEnabled || !supabase;

const enableMemoryFallback = (reason: unknown) => {
  if (!isDevEnvironment) {
    return false;
  }

  if (!memoryFallbackEnabled) {
    console.warn(
      "[sessions] Falling back to in-memory store due to Supabase error:",
      reason,
    );
  }

  memoryFallbackEnabled = true;
  diagnostics = {
    backend: "memory",
    lastError:
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : JSON.stringify(reason),
  };
  return true;
};

const markSupabaseSuccess = () => {
  if (!memoryFallbackEnabled) {
    diagnostics = {
      backend: "supabase",
      lastError: null,
    };
  }
};

export const getSessionRepositoryDiagnostics = () => diagnostics;

export async function listSessionsForUser(
  supabase: SupabaseClient | null,
  userId: string,
): Promise<SessionRow[]> {
  if (shouldUseMemoryStore(supabase)) {
    return memoryListSessions(userId);
  }

  const client = supabase;
  if (!client) {
    throw new Error("Supabase client is not available.");
  }

  const { data, error } = await client
    .from("sessions")
    .select("id, user_id, title, tree_json, token_usage")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    if (enableMemoryFallback(error ?? new Error("Unknown Supabase error."))) {
      return memoryListSessions(userId);
    }

    throw new Error(`Failed to load sessions: ${error?.message ?? "Unknown"}`);
  }

  markSupabaseSuccess();
  return data as SessionRow[];
}

export async function insertSession(
  supabase: SupabaseClient | null,
  userId: string,
  payload: {
    title: string;
    tree: BranchNode;
    tokenUsage: number;
  },
): Promise<SessionRow> {
  if (shouldUseMemoryStore(supabase)) {
    return memoryInsertSession(userId, payload);
  }

  const client = supabase;
  if (!client) {
    throw new Error("Supabase client is not available.");
  }

  const { data, error } = await client
    .from("sessions")
    .insert({
      user_id: userId,
      title: payload.title,
      tree_json: payload.tree,
      token_usage: payload.tokenUsage,
    })
    .select("id, user_id, title, tree_json, token_usage")
    .single();

  if (error || !data) {
    if (enableMemoryFallback(error ?? new Error("Unknown Supabase error."))) {
      return memoryInsertSession(userId, payload);
    }

    throw new Error(`Failed to insert session: ${error?.message ?? "Unknown"}`);
  }

  markSupabaseSuccess();
  return data as SessionRow;
}

export async function fetchSession(
  supabase: SupabaseClient | null,
  sessionId: string,
  userId: string,
): Promise<SessionRow> {
  if (shouldUseMemoryStore(supabase)) {
    return memoryFetchSession(userId, sessionId);
  }

  const client = supabase;
  if (!client) {
    throw new Error("Supabase client is not available.");
  }

  const { data, error } = await client
    .from("sessions")
    .select("id, user_id, title, tree_json, token_usage")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    if (enableMemoryFallback(error ?? new Error("Unknown Supabase error."))) {
      return memoryFetchSession(userId, sessionId);
    }

    throw new Error(
      `Session not found or access denied: ${error?.message ?? ""}`,
    );
  }

  markSupabaseSuccess();
  return data as SessionRow;
}

export async function updateSessionTree(
  supabase: SupabaseClient | null,
  sessionId: string,
  userId: string,
  payload: {
    title?: string;
    tree: BranchNode;
    tokenUsage: number;
  },
): Promise<SessionRow> {
  if (shouldUseMemoryStore(supabase)) {
    return memoryUpdateSession(userId, sessionId, payload);
  }

  const client = supabase;
  if (!client) {
    throw new Error("Supabase client is not available.");
  }

  const updatePayload: {
    title?: string;
    tree_json: BranchNode;
    token_usage: number;
  } = {
    tree_json: payload.tree,
    token_usage: payload.tokenUsage,
  };

  if (payload.title !== undefined) {
    updatePayload.title = payload.title;
  }

  const { data, error } = await client
    .from("sessions")
    .update(updatePayload)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("id, user_id, title, tree_json, token_usage")
    .single();

  if (error || !data) {
    if (enableMemoryFallback(error ?? new Error("Unknown Supabase error."))) {
      return memoryUpdateSession(userId, sessionId, payload);
    }

    throw new Error(`Failed to update session: ${error?.message ?? "Unknown"}`);
  }

  markSupabaseSuccess();
  return data as SessionRow;
}

export async function deleteSession(
  supabase: SupabaseClient | null,
  sessionId: string,
  userId: string,
): Promise<void> {
  if (shouldUseMemoryStore(supabase)) {
    memoryDeleteSession(userId, sessionId);
    return;
  }

  const client = supabase;
  if (!client) {
    throw new Error("Supabase client is not available.");
  }

  const { error } = await client
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    if (enableMemoryFallback(error)) {
      memoryDeleteSession(userId, sessionId);
      return;
    }

    throw new Error(`Failed to delete session: ${error.message}`);
  }

  markSupabaseSuccess();
}

export function mapRowToSessionTree(row: SessionRow): SessionTree {
  return {
    id: row.id,
    title: row.title,
    isPlaceholder: false,
    tokenUsage: row.token_usage,
    root: row.tree_json,
  };
}
