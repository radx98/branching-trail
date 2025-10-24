import type { BranchNode } from "@/lib/types/tree";

export type NodeTrail = {
  node: BranchNode;
  parent: BranchNode | null;
  breadcrumb: BranchNode[];
};

export function cloneTree(root: BranchNode): BranchNode {
  return JSON.parse(JSON.stringify(root)) as BranchNode;
}

export function findNodeWithTrail(
  root: BranchNode,
  nodeId: string,
): NodeTrail | null {
  return search(root, nodeId, []);
}

function search(
  current: BranchNode,
  nodeId: string,
  trail: BranchNode[],
): NodeTrail | null {
  if (current.id === nodeId) {
    return {
      node: current,
      parent: trail[trail.length - 1] ?? null,
      breadcrumb: trail,
    };
  }

  for (const child of current.children) {
    const found = search(child, nodeId, [...trail, current]);
    if (found) {
      return found;
    }
  }

  return null;
}

export function ensureSpecifyChild(
  target: BranchNode,
  specifyNodeFactory: (parentId: string) => BranchNode,
): void {
  if (target.variant === "specify") {
    target.children = [];
    return;
  }

  const structuralChildren = target.children.filter(
    (child) => child.variant !== "specify",
  );

  if (structuralChildren.length === 0) {
    target.children = [];
    return;
  }

  const existingSpecify = target.children.find(
    (child) => child.variant === "specify",
  );

  const specifyChild = existingSpecify ?? specifyNodeFactory(target.id);

  target.children = [...structuralChildren, specifyChild];
}

export function walkTree(
  root: BranchNode,
  action: (node: BranchNode, parent: BranchNode | null) => void,
  parent: BranchNode | null = null,
) {
  action(root, parent);
  root.children.forEach((child) => walkTree(child, action, root));
}
