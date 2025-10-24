import type { BranchNode } from "@/lib/types/tree";

export function createSpecifyNode(parentId: string): BranchNode {
  return {
    id: `${parentId}::specify`,
    title: "",
    prompt: "",
    variant: "specify",
    status: "idle",
    children: [],
  };
}

export function createOptionNode(params: {
  parentId: string;
  index: number;
  title: string;
}): BranchNode {
  return {
    id: `${params.parentId}::opt-${params.index + 1}`,
    title: params.title,
    prompt: "",
    variant: "option",
    status: "idle",
    children: [],
  };
}
