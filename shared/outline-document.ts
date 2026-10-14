// @ts-ignore Node 24 loads shared TypeScript helpers directly.
import { MAX_BLOCK_DEPTH, MAX_THEME_BLOCKS } from "./block-limits.ts";
import type { BlockDefinition, BlockNode } from "./theme-models";
// @ts-ignore Node 24 loads this shared TypeScript helper directly; Angular resolves the same source.
import * as contextBlocks from "./context-blocks.ts";
const { canPlacePagination, paginationPlacementValid, postListChildren } =
  contextBlocks;

export const OUTLINE_API_VERSION = 1;
export interface OutlineMetadata {
  label?: string;
  icon?: string;
}
export interface OutlineTreeNode {
  id: string;
  type: string;
  label: string;
  icon: string;
  summary: string;
  movable: boolean;
  removable: boolean;
  children?: OutlineTreeNode[];
}
export type OutlineCommand =
  | {
      type: "insert";
      parentId: string;
      index: number;
      blockType: string;
      settings?: Record<string, unknown>;
    }
  | { type: "move"; id: string; parentId: string; index: number }
  | { type: "duplicate" | "remove"; id: string }
  | { type: "update"; id: string; settings: Record<string, unknown> }
  | { type: "rename"; id: string; label: string }
  | { type: "icon"; id: string; icon: string }
  | { type: "paste"; parentId: string; index: number; node: BlockNode };

export function validOutlineMetadata(value: unknown): value is OutlineMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const metadata = value as OutlineMetadata;
  return (
    Object.keys(metadata).every((key) => ["label", "icon"].includes(key)) &&
    (metadata.label === undefined ||
      (typeof metadata.label === "string" &&
        metadata.label.trim().length > 0 &&
        metadata.label.length <= 80 &&
        !/[<>\x00-\x1f]/.test(metadata.label))) &&
    (metadata.icon === undefined ||
      (typeof metadata.icon === "string" &&
        /^(?:fas )?fa-[a-z][a-z0-9-]{0,49}$/.test(metadata.icon)))
  );
}
export function findOutlineBlock(
  root: BlockNode,
  id: string,
): BlockNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children || []) {
    const found = findOutlineBlock(child, id);
    if (found) return found;
  }
  return undefined;
}
function parentOf(root: BlockNode, id: string): BlockNode | undefined {
  if (root.children?.some((child) => child.id === id)) return root;
  for (const child of root.children || []) {
    const found = parentOf(child, id);
    if (found) return found;
  }
  return undefined;
}
export function outlineSummary(node: BlockNode) {
  return String(
    node.settings.label ||
      node.settings.text ||
      node.settings.html ||
      node.settings.classes ||
      "",
  )
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#\d+);/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
export function outlineLabel(
  node: BlockNode,
  definitions: BlockDefinition[],
  root?: BlockNode,
  rootLabel = "Body",
) {
  if (node === root) return rootLabel;
  return (
    node.editor?.label ||
    definitions.find((def) => def.type === node.type)?.label ||
    node.type
  );
}
export function outlineIcon(node: BlockNode, definitions: BlockDefinition[]) {
  return (
    node.editor?.icon ||
    definitions.find((def) => def.type === node.type)?.icon ||
    (node.type.startsWith("theme/part-")
      ? "fas fa-layer-group"
      : "fas fa-block")
  );
}
export function outlineSnapshot(
  root: BlockNode,
  definitions: BlockDefinition[],
  rootLabel = "Body",
) {
  const visit = (node: BlockNode): OutlineTreeNode => ({
    id: node.id,
    type: node.type,
    label: outlineLabel(node, definitions, root, rootLabel),
    icon:
      node === root
        ? rootLabel === "Main"
          ? "fas fa-file-alt"
          : "fas fa-file-code"
        : outlineIcon(node, definitions),
    summary: outlineSummary(node),
    movable: node !== root,
    removable: node !== root,
    ...(node.children ? { children: node.children.map(visit) } : {}),
  });
  return { apiVersion: OUTLINE_API_VERSION, root: visit(root) };
}
function safeSettings(
  value: unknown,
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    JSON.stringify(value).length > 100000
  )
    throw Error("Invalid block settings.");
  const visit = (item: unknown) => {
    if (!item || typeof item !== "object") return;
    for (const [key, nested] of Object.entries(item)) {
      if (["__proto__", "prototype", "constructor"].includes(key))
        throw Error("Invalid block settings key.");
      visit(nested);
    }
  };
  visit(value);
}
function accepts(parent: BlockNode, child: BlockNode) {
  if (["core/menu", "core/menu-item"].includes(parent.type))
    return [
      "core/button",
      "core/menu-item",
      "core/custom-link",
      "core/search",
    ].includes(child.type);
  if (child.type === "core/menu-item") return false;
  if (parent.type === "core/slider") return child.type === "core/slide";
  if (child.type === "core/slide") return false;
  if (parent.type === "core/gltf") return child.type === "core/overlay";
  if (child.type === "core/overlay")
    return ["core/gltf", "core/slide"].includes(parent.type);
  if (child.type === "core/column") return parent.type === "core/columns";
  return true;
}
/** The same document commands power the local editor and authenticated HTTP drafts. */
export function applyOutlineCommand(
  root: BlockNode,
  command: OutlineCommand,
  definitions: BlockDefinition[],
): string {
  if (!command || typeof command !== "object")
    throw Error("An outline command is required.");
  const definition = (type: string) =>
    definitions.find((def) => def.type === type);
  const make = (type: string): BlockNode => {
    const def = definition(type);
    if (!def) throw Error("Unknown block type.");
    if (def.disabled)
      throw Error(def.description || "This block cannot be placed here.");
    return {
      id: "blk_" + crypto.randomUUID(),
      type,
      settings: {
        ...(type === "core/menu" ? { automaticPages: false } : {}),
        ...Object.fromEntries(
          def.fields.map((field) => [
            field.key,
            structuredClone(field.default ?? ""),
          ]),
        ),
      },
      ...(def.container
        ? {
            children:
              type === "core/columns"
                ? [make("core/column"), make("core/column")]
                : type === "core/slider"
                  ? [make("core/slide"), make("core/slide")]
                  : type === "core/post-list"
                    ? postListChildren((childType, settings) => {
                        const child = make(childType);
                        Object.assign(child.settings, settings);
                        return child;
                      })
                    : [],
          }
        : {}),
    };
  };
  const copy = (node: BlockNode): BlockNode => ({
    ...structuredClone(node),
    id: "blk_" + crypto.randomUUID(),
    ...(node.children ? { children: node.children.map(copy) } : {}),
  });
  const locate = (id: string) => {
    const node = findOutlineBlock(root, id);
    if (!node) throw Error("Block not found in this outline.");
    return node;
  };
  const place = (node: BlockNode, parentId: string, index: number) => {
    const parent = locate(parentId);
    if (
      !parent.children ||
      !Number.isInteger(index) ||
      index < 0 ||
      index > parent.children.length
    )
      throw Error("Choose a valid container and insertion index.");
    if (!canPlacePagination(root, parent, node))
      throw Error(
        "Pagination must be inside a Post list or one of its layout blocks.",
      );
    if (!accepts(parent, node))
      throw Error("This block cannot be placed in that container.");
    if (parent.type === "core/columns" && node.type !== "core/column") {
      const wrapper = make("core/column");
      wrapper.children = [node];
      parent.children.splice(index, 0, wrapper);
    } else parent.children.splice(index, 0, node);
  };
  let selected = root.id;
  if (command.type === "insert") {
    const node = make(command.blockType);
    if (command.settings !== undefined) {
      safeSettings(command.settings);
      Object.assign(node.settings, command.settings);
    }
    place(node, command.parentId, command.index);
    selected = node.id;
  } else if (command.type === "paste") {
    if (!command.node) throw Error("A block is required to paste.");
    const node = copy(command.node);
    place(node, command.parentId, command.index);
    selected = node.id;
  } else {
    const node = locate(command.id);
    selected = node.id;
    const parent = parentOf(root, node.id);
    if (command.type === "move") {
      if (!parent) throw Error("The document root cannot be moved.");
      if (findOutlineBlock(node, command.parentId))
        throw Error("A block cannot be placed inside itself.");
      const destination = locate(command.parentId);
      if (
        !destination.children ||
        !Number.isInteger(command.index) ||
        command.index < 0 ||
        command.index > destination.children.length ||
        !accepts(destination, node) ||
        !canPlacePagination(root, destination, node)
      )
        throw Error("Invalid block destination.");
      const previous = parent.children!.indexOf(node);
      parent.children!.splice(previous, 1);
      place(
        node,
        command.parentId,
        command.index -
          (parent === destination && previous < command.index ? 1 : 0),
      );
    } else if (command.type === "duplicate" || command.type === "remove") {
      if (!parent) throw Error("The document root is protected.");
      if (command.type === "duplicate") {
        const duplicate = copy(node);
        place(duplicate, parent.id, parent.children!.indexOf(node) + 1);
        selected = duplicate.id;
      } else {
        if (
          (node.type === "core/column" || node.type === "core/slide") &&
          parent.children!.length === 1
        )
          throw Error("Keep at least one child, or remove the parent block.");
        parent.children!.splice(parent.children!.indexOf(node), 1);
        selected = parent.id;
      }
    } else if (command.type === "update") {
      safeSettings(command.settings);
      Object.assign(node.settings, command.settings);
      if (node.type === "core/heading" && "text" in command.settings)
        delete node.settings.html;
    } else if (command.type === "rename" || command.type === "icon") {
      if (node === root)
        throw Error("The document root keeps its semantic label and icon.");
      const editor = {
        ...node.editor,
        ...(command.type === "rename"
          ? { label: command.label?.trim() }
          : { icon: command.icon }),
      };
      if (!validOutlineMetadata(editor))
        throw Error("Use a short plain-text label and a valid icon token.");
      node.editor = editor;
    } else throw Error("Unknown outline command.");
  }
  const ids = new Set<string>();
  let total = 0;
  const check = (node: BlockNode, depth: number, parent?: BlockNode) => {
    if (++total > MAX_THEME_BLOCKS)
      throw Error(
        `Blocks are limited to ${MAX_THEME_BLOCKS.toLocaleString("en-US")} items.`,
      );
    if (depth > MAX_BLOCK_DEPTH)
      throw Error(
        `Blocks exceed the maximum nesting depth of ${MAX_BLOCK_DEPTH}. Move the block closer to the document root.`,
      );
    if (
      !node ||
      typeof node.id !== "string" ||
      ids.has(node.id) ||
      (!definition(node.type) && !node.type.startsWith("theme/part-"))
    )
      throw Error("Invalid block or duplicate block ID.");
    ids.add(node.id);
    safeSettings(node.settings);
    if (node.editor !== undefined && !validOutlineMetadata(node.editor))
      throw Error("Invalid outline metadata.");
    if (
      parent &&
      (!accepts(parent, node) ||
        (parent.type === "core/columns" && node.type !== "core/column"))
    )
      throw Error("Invalid block nesting.");
    if (
      node.children &&
      (!Array.isArray(node.children) || !definition(node.type)?.container)
    )
      throw Error("This block does not accept children.");
    node.children?.forEach((child) => check(child, depth + 1, node));
  };
  check(root, 0);
  if (!paginationPlacementValid(root))
    throw Error(
      "Pagination must be inside a Post list or one of its layout blocks.",
    );
  return selected;
}
