import type { BlockDefinition, BlockNode } from "./theme-models";

export const SHARED_PARTS_CATEGORY = "Shared Parts";
export function sharedPartName(type: string) {
  return /^theme\/part-([a-z][a-z0-9-]*)$/.exec(type || "")?.[1];
}
export function sharedPartLabel(name: string) {
  return name.replace(
    /(^|-)([a-z])/g,
    (_, separator, letter) => (separator ? " " : "") + letter.toUpperCase(),
  );
}

/** References retain their shared content; each placed block has its own settings. */
export function sharedPartDefinitions(
  parts: Record<string, BlockNode>,
  currentPart = "",
  contentOnly = false,
): BlockDefinition[] {
  return Object.keys(parts).map((name) => {
    const type = "theme/part-" + name;
    const reason = sharedPartPlacementError(
      { id: "", type, settings: {} },
      parts,
      currentPart,
      contentOnly,
    );
    return {
      type,
      label: sharedPartLabel(name),
      category: SHARED_PARTS_CATEGORY,
      icon: "fas fa-layer-group",
      description: reason || "Shared content · edits update every use",
      fields: [],
      toolbar: [],
      ...(reason ? { disabled: true } : {}),
    };
  });
}

/** Check reference paths before rendering or placing a block, without expanding trees. */
export function sharedPartPlacementError(
  root: BlockNode,
  parts: Record<string, BlockNode>,
  currentPart = "",
  contentOnly = false,
): string {
  const checked = new Set<string>();
  let count = 0;
  const visit = (node: BlockNode, trail: Set<string>): string => {
    if (!node || ++count > 10000) return "Shared part layout is too complex.";
    if (
      contentOnly &&
      trail.size &&
      ["core/content", "core/post-content"].includes(node.type)
    )
      return "This shared part renders the page body and cannot be placed inside it.";
    const name = sharedPartName(node.type);
    if (name) {
      if (!Object.hasOwn(parts, name)) return "Unknown shared part.";
      if (trail.has(name))
        return "Shared parts cannot contain circular references.";
      if (!checked.has(name)) {
        const error = visit(parts[name], new Set([...trail, name]));
        if (error) return error;
        checked.add(name);
      }
    }
    for (const child of node.children || []) {
      const error = visit(child, trail);
      if (error) return error;
    }
    return "";
  };
  return visit(root, new Set(currentPart ? [currentPart] : []));
}

export function sharedPartsError(parts: Record<string, BlockNode>) {
  for (const [name, root] of Object.entries(parts)) {
    const error = sharedPartPlacementError(root, parts, name);
    if (error) return error;
  }
  return "";
}
