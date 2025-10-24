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
  tokenUsage?: number | null;
}
