import type { BlockNode } from "./theme-models";
// @ts-ignore Node 24 loads shared TypeScript directly.
import { MAX_BLOCK_DEPTH } from "./block-limits.ts";
function patternError(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}
export interface BlockPattern {
  id: string;
  name: string;
  category: string;
  description?: string;
  blocks: BlockNode[];
}
export interface PatternSource {
  id: string;
  name: string;
  kind: "core" | "theme" | "plugin";
}
export interface RegisteredPattern extends BlockPattern {
  key: string;
  source: PatternSource;
}
/** Declarative registration only. Rendering and persistence still sanitize block settings. */
export function validateBlockPatterns(
  value: unknown,
): asserts value is BlockPattern[] {
  if (value === undefined) return;
  if (
    !Array.isArray(value) ||
    value.length > 50 ||
    JSON.stringify(value).length > 300000
  )
    throw patternError("Declare up to 50 block patterns within 300 KB.");
  const ids = new Set<string>();
  for (const pattern of value) {
    if (
      !pattern ||
      !/^[a-z][a-z0-9-]{0,79}$/.test(pattern.id) ||
      ids.has(pattern.id)
    )
      throw patternError(
        "Use unique pattern IDs containing lowercase letters, numbers and hyphens.",
      );
    ids.add(pattern.id);
    for (const key of ["name", "category"])
      if (
        typeof pattern[key] !== "string" ||
        !pattern[key].trim() ||
        pattern[key].length > 100 ||
        /[<>\x00-\x1f]/.test(pattern[key])
      )
        throw patternError("Patterns need a plain-text name and category.");
    if (
      pattern.description !== undefined &&
      (typeof pattern.description !== "string" ||
        pattern.description.length > 500)
    )
      throw patternError("Pattern descriptions are limited to 500 characters.");
    if (!Array.isArray(pattern.blocks) || !pattern.blocks.length)
      throw patternError("Patterns must contain blocks.");
    let count = 0;
    const nodeIds = new Set<string>();
    const visit = (node: BlockNode, depth: number) => {
      if (
        ++count > 100 ||
        depth > MAX_BLOCK_DEPTH ||
        !node ||
        typeof node.id !== "string" ||
        !node.id ||
        nodeIds.has(node.id) ||
        typeof node.type !== "string" ||
        !node.settings ||
        typeof node.settings !== "object" ||
        Array.isArray(node.settings)
      )
        throw patternError(
          "Pattern blocks must have unique IDs and valid settings, with at most 100 blocks and 16 nesting levels.",
        );
      nodeIds.add(node.id);
      if (node.children !== undefined) {
        if (!Array.isArray(node.children))
          throw patternError("Pattern children must be a block array.");
        node.children.forEach((child) => visit(child, depth + 1));
      }
    };
    pattern.blocks.forEach((node: BlockNode) => visit(node, 0));
  }
}
export function registerBlockPatterns(
  source: PatternSource,
  patterns: BlockPattern[] = [],
): RegisteredPattern[] {
  validateBlockPatterns(patterns);
  return patterns.map((pattern) => ({
    ...structuredClone(pattern),
    key: source.kind + ":" + source.id + ":" + pattern.id,
    source: { ...source },
  }));
}
export function clonePatternBlocks(pattern: BlockPattern): BlockNode[] {
  validateBlockPatterns([pattern]);
  const copy = (node: BlockNode): BlockNode => ({
    ...structuredClone(node),
    id: "blk_" + crypto.randomUUID(),
    settings: {
      ...structuredClone(node.settings),
      ...(node.settings.anchor
        ? {
            anchor:
              node.settings.anchor + "-" + crypto.randomUUID().slice(0, 8),
          }
        : {}),
    },
    ...(node.children ? { children: node.children.map(copy) } : {}),
  });
  return pattern.blocks.map(copy);
}
