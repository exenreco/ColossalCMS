import type { BlockDefinition, BlockNode } from "./theme-models";
// @ts-ignore Shared with Node 24.
import { applyOutlineCommand, findOutlineBlock } from "./outline-document.ts";
import type { OutlineCommand } from "./outline-document";

export type BatchCommand = OutlineCommand & { ref?: string };
export const appearanceFields = [
  "color",
  "background",
  "backgroundGradient",
  "fontFamily",
  "fontSize",
  "align",
  "lineHeight",
  "textIndent",
  "bold",
  "italic",
  "underline",
  "strike",
  "maxWidth",
  "minHeight",
  "minHeightUnit",
  "minHeightEnabled",
  "minHeightByBreakpoint",
  "verticalAlign",
  "margin",
  "padding",
  "border",
  "borderColors",
  "borderStyles",
  "borderSides",
  "radius",
  "radiusCorners",
  "display",
  "position",
  "zIndex",
  "offsets",
  "flex",
  "flexWrap",
  "flexShrink",
  "gridColumns",
  "gap",
  "justify",
  "alignItems",
  "transform",
  "animations",
  "glassEnabled",
  "glassBlur",
  "glassSaturation",
  "classes",
  "anchor",
  "borderWidth",
  "borderStyle",
  "borderColor",
  "fullBleed",
  "link",
  "linkDecoration",
  "linkColors",
];
export async function editorRevision(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Detached, all-or-nothing document edits. Callers sanitize before committing. */
export function editorBatch(
  root: BlockNode,
  commands: BatchCommand[],
  catalog: BlockDefinition[],
) {
  if (!Array.isArray(commands) || !commands.length || commands.length > 40)
    throw Error("Choose between 1 and 40 block commands.");
  const next = structuredClone(root);
  const refs = new Map<string, string>();
  let selectedId = root.id;
  for (const input of commands) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw Error("Use a document command object.");
    const command = structuredClone(input);
    if (
      ![
        "insert",
        "move",
        "duplicate",
        "remove",
        "update",
        "rename",
        "icon",
        "paste",
      ].includes(command.type)
    )
      throw Error("Only document commands can be used in a batch.");
    for (const key of ["id", "parentId"] as const) {
      const value = (command as any)[key];
      if (typeof value === "string" && value.startsWith("$")) {
        if (!refs.has(value.slice(1)))
          throw Error("Unknown inserted block reference.");
        (command as any)[key] = refs.get(value.slice(1));
      }
    }
    const checkSettings = (type: string, settings: Record<string, unknown>) => {
      if (!settings || typeof settings !== "object" || Array.isArray(settings))
        throw Error("Use a block settings object.");
      if (type === "core/slider" && Object.hasOwn(settings, "animations"))
        throw Error("Slider animation is controlled by its Swiper settings.");
      const allowed = new Set([
        ...appearanceFields,
        ...(catalog.find((d) => d.type === type)?.fields || []).map(
          (f) => f.key,
        ),
      ]);
      for (const key of Object.keys(settings)) {
        if (!allowed.has(key))
          throw Error(`Unsupported setting ${key} for ${type}.`);
        const field = catalog
          .find((d) => d.type === type)
          ?.fields.find((f) => f.key === key);
        const value = settings[key];
        if (field?.options && !field.options.includes(value as string))
          throw Error(`Choose a supported ${key} option.`);
        if (field?.type === "checkbox" && typeof value !== "boolean")
          throw Error(`${key} must be true or false.`);
        if (
          field?.type === "number" &&
          !(
            [
              "maxWidth",
              "minHeight",
              "gap",
              "fontSize",
              "lineHeight",
              "textIndent",
              "borderWidth",
              "radius",
            ].includes(key) &&
            typeof value === "string" &&
            /^(?:auto|-?\d+(?:\.\d+)?(?:px|%|rem|em|vw|vh))$/.test(value)
          ) &&
          (typeof value !== "number" ||
            !Number.isFinite(value) ||
            (field.min !== undefined && value < field.min) ||
            (field.max !== undefined && value > field.max))
        )
          throw Error(`Choose a valid ${key} number.`);
      }
    };
    if (command.type === "insert" && command.settings)
      checkSettings(command.blockType, command.settings);
    if (command.type === "update") {
      const node = findOutlineBlock(next, command.id);
      if (!node) throw Error("Block no longer exists.");
      checkSettings(node.type, command.settings);
    }
    if (command.type === "paste") {
      const visit = (node: BlockNode) => {
        checkSettings(node.type, node.settings);
        node.children?.forEach(visit);
      };
      visit(command.node);
    }
    selectedId = applyOutlineCommand(next, command, catalog);
    if (command.ref) {
      if (
        !/^[a-z][a-z0-9_-]{0,39}$/i.test(command.ref) ||
        refs.has(command.ref)
      )
        throw Error("Use a unique inserted block reference.");
      refs.set(command.ref, selectedId);
    }
  }
  return { root: next, selectedId };
}

export function editorDiff(before: BlockNode, after: BlockNode) {
  const flatten = (root: BlockNode) => {
    const map = new Map<
      string,
      { node: BlockNode; parentId: string; index: number }
    >();
    const visit = (node: BlockNode, parentId = "", index = 0) => {
      map.set(node.id, { node, parentId, index });
      node.children?.forEach((child, i) => visit(child, node.id, i));
    };
    visit(root);
    return map;
  };
  const a = flatten(before),
    b = flatten(after);
  const changes: {
    id: string;
    type: string;
    action: string;
    before?: unknown;
    after?: unknown;
  }[] = [];
  for (const [id, entry] of a) {
    const current = b.get(id);
    if (!current) changes.push({ id, type: entry.node.type, action: "Remove" });
    else {
      if (entry.parentId !== current.parentId || entry.index !== current.index)
        changes.push({ id, type: current.node.type, action: "Move" });
      if (
        JSON.stringify([entry.node.settings, entry.node.editor]) !==
        JSON.stringify([current.node.settings, current.node.editor])
      )
        changes.push({
          id,
          type: current.node.type,
          action: "Update",
          before: { settings: entry.node.settings, editor: entry.node.editor },
          after: {
            settings: current.node.settings,
            editor: current.node.editor,
          },
        });
    }
  }
  for (const [id, entry] of b)
    if (!a.has(id))
      changes.push({
        id,
        type: entry.node.type,
        action: "Insert",
        after: entry.node.settings,
      });
  return changes;
}
