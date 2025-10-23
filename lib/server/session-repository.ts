import type { SupabaseClient } from "@supabase/supabase-js";

import type { BranchNode, SessionTree } from "@/lib/types/tree";

type SessionRow = {
  id: string;
  user_id: string;
  title: string;
  tree_json: BranchNode;
  token_usage: number | null;
};

export async function listSessionsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, user_id, title, tree_json, token_usage")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    throw new Error(`Failed to load sessions: ${error?.message ?? "Unknown"}`);
  }

  return data as SessionRow[];
}

export async function insertSession(
  supabase: SupabaseClient,
  userId: string,
  payload: {
    title: string;
    tree: BranchNode;
    tokenUsage: number;
  },
): Promise<SessionRow> {
  const { data, error } = await supabase
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
    throw new Error(`Failed to insert session: ${error?.message ?? "Unknown"}`);
  }

  return data as SessionRow;
}

export async function fetchSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
): Promise<SessionRow> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, user_id, title, tree_json, token_usage")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error(`Session not found or access denied: ${error?.message ?? ""}`);
  }

  return data as SessionRow;
}

export async function updateSessionTree(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  payload: {
    title?: string;
    tree: BranchNode;
    tokenUsage: number;
  },
): Promise<SessionRow> {
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

  const { data, error } = await supabase
    .from("sessions")
    .update(updatePayload)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("id, user_id, title, tree_json, token_usage")
    .single();

  if (error || !data) {
    throw new Error(`Failed to update session: ${error?.message ?? "Unknown"}`);
  }

  return data as SessionRow;
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
