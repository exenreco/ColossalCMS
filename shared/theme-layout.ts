import { BlockNode, ThemeDocument } from "./theme-models";

/** Upgrade old column trees without changing the IDs or settings of their content. */
export function normalizeColumns(node: BlockNode): number {
  let count = 0;
  if (node.type === "core/columns") {
    node.children = (node.children || []).map((child) => {
      if (child.type === "core/column") return child;
      count++;
      return {
        id: "blk_" + crypto.randomUUID(),
        type: "core/column",
        settings: { width: "1fr" },
        children: [child],
      };
    });
    delete node.settings["columns"];
  }
  for (const child of node.children || []) count += normalizeColumns(child);
  return count;
}

export function normalizeDocumentColumns(document: ThemeDocument): number {
  return [
    ...Object.values(document.templates),
    ...Object.values(document.parts),
  ].reduce((count, root) => count + normalizeColumns(root), 0);
}
