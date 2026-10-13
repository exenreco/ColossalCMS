// @ts-ignore Node 24 loads this shared TypeScript helper directly.
import { MAX_BLOCK_DEPTH } from "./block-limits.ts";
import type { ThemeDocument, BlockNode } from "./theme-models";

/** The storage identifier stays stable so existing themes and content remain valid. */
export const FORMATTED_HTML_TYPE = "core/rich-text";

/** Legacy fragments share the same sanitized source and now use the canvas editor. */
export function normalizeFormattedHtmlBlocks(nodes: BlockNode[], depth = 0) {
  if (depth > MAX_BLOCK_DEPTH) return;
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    if (node.type === "core/html") node.type = FORMATTED_HTML_TYPE;
    if (
      node.type === FORMATTED_HTML_TYPE &&
      node.editor &&
      ["Rich text", "HTML fragment"].includes(node.editor.label || "")
    )
      node.editor.label = "Formatted HTML";
    if (Array.isArray(node.children))
      normalizeFormattedHtmlBlocks(node.children, depth + 1);
  }
}

export function normalizeFormattedHtmlNames(document: ThemeDocument) {
  for (const collection of [
    document.blocks || [],
    document.manifest.blocks || [],
  ]) {
    let canonical = collection.some(
      (entry) => entry.type === FORMATTED_HTML_TYPE,
    );
    for (let index = collection.length - 1; index >= 0; index--) {
      const entry = collection[index];
      if (entry.type !== "core/html") continue;
      if (canonical) collection.splice(index, 1);
      else {
        entry.type = FORMATTED_HTML_TYPE;
        canonical = true;
        if ("label" in entry && entry.label === "HTML fragment")
          entry.label = "Formatted HTML";
        if ("category" in entry && entry.category === "Theme")
          entry.category = "Content";
      }
    }
  }
  for (const definition of document.blocks || []) {
    if (definition.type !== FORMATTED_HTML_TYPE) continue;
    if (definition.label === "Rich text") definition.label = "Formatted HTML";
    if (definition.icon === "fas fa-align-left")
      definition.icon = "fas fa-code";
  }
  for (const entry of document.manifest.blocks || [])
    if (
      entry.type === FORMATTED_HTML_TYPE &&
      entry.icon === "fas fa-align-left"
    )
      entry.icon = "fas fa-code";
  normalizeFormattedHtmlBlocks([
    ...Object.values(document.templates),
    ...Object.values(document.parts),
  ]);
}

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const span = (kind: string, value: string) =>
  `<span class="cl-html-${kind}">${escape(value)}</span>`;

/** Escapes every source character before decorating it; source markup never becomes live DOM. */
export function highlightHtml(source: string) {
  let output = "",
    index = 0;
  const tokens =
    /<!--[\s\S]*?(?:-->|$)|{{[\s\S]*?}}|<!DOCTYPE[^>]*>|<\/?[a-zA-Z][^>]*>?|&(?:#\d+|#x[\da-fA-F]+|\w+);/gi;
  for (const match of source.matchAll(tokens)) {
    output += escape(source.slice(index, match.index));
    const text = match[0];
    if (text.startsWith("<!--")) output += span("comment", text);
    else if (text.startsWith("{{") || text.startsWith("&"))
      output += span("value", text);
    else {
      let tagIndex = 0;
      for (const part of text.matchAll(
        /"[^"]*"|'[^']*'|<\/?[\w:-]+|[\w:-]+(?=\s*=)|\/?>/g,
      )) {
        output += escape(text.slice(tagIndex, part.index));
        output += span(
          /^["']/.test(part[0])
            ? "string"
            : part[0].includes("<") || part[0].includes(">")
              ? "tag"
              : "attribute",
          part[0],
        );
        tagIndex = part.index! + part[0].length;
      }
      output += escape(text.slice(tagIndex));
    }
    index = match.index! + text.length;
  }
  return output + escape(source.slice(index));
}

/** Keyboard edits retain selection across one or several source lines. */
export function indentHtml(
  source: string,
  start: number,
  end: number,
  outdent = false,
) {
  const lineStart = source.slice(0, start).lastIndexOf("\n") + 1;
  const lineEnd = source.indexOf("\n", end);
  const boundary = lineEnd < 0 ? source.length : lineEnd;
  if (start === end && !outdent)
    return {
      value: source.slice(0, start) + "  " + source.slice(end),
      start: start + 2,
      end: start + 2,
    };
  const lines = source.slice(lineStart, boundary).split("\n");
  let delta = 0,
    firstDelta = 0;
  const changed = lines
    .map((line, index) => {
      const remove = outdent
        ? line.match(/^(?: {1,2}|\t)/)?.[0].length || 0
        : 0;
      const difference = outdent ? -remove : 2;
      if (!index) firstDelta = difference;
      delta += difference;
      return outdent ? line.slice(remove) : "  " + line;
    })
    .join("\n");
  return {
    value: source.slice(0, lineStart) + changed + source.slice(boundary),
    start: Math.max(lineStart, start + firstDelta),
    end: Math.max(lineStart, end + delta),
  };
}
