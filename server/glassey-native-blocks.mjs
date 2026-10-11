import { parseDocument } from "htmlparser2";
import { textContent, getInnerHTML } from "domutils";

const elements = (nodes) =>
  nodes.filter((node) => node.type !== "text" || node.data.trim());
const classes = (...values) => values.filter(Boolean).join(" ");
const native = (id, type, settings, children) => ({
  id,
  type,
  settings,
  ...(children ? { children } : {}),
});
const simpleAttributes = (node, allowed) =>
  Object.keys(node.attribs || {}).every((key) => allowed.includes(key));
const inlineParagraph = (nodes) =>
  nodes.every(
    (node) =>
      node.type === "text" ||
      ([
        "br",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "s",
        "strike",
        "code",
        "span",
        "small",
        "mark",
        "sup",
        "sub",
        "a",
      ].includes(node.name) &&
        simpleAttributes(
          node,
          node.name === "a"
            ? ["href", "target", "rel"]
            : node.name === "span"
              ? ["style"]
              : [],
        ) &&
        inlineParagraph(node.children || [])),
  );

function convert(node, id) {
  if (node.type === "text")
    return native(id, "core/paragraph", {
      html: node.data
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;"),
    });
  const attrs = node.attribs || {};
  if (
    (node.name === "p" || /^h[1-6]$/.test(node.name || "")) &&
    simpleAttributes(node, ["class", "id"]) &&
    (node.name !== "p" || inlineParagraph(node.children || []))
  )
    return native(id, node.name === "p" ? "core/paragraph" : "core/heading", {
      html: getInnerHTML(node),
      classes: attrs.class || "",
      ...(attrs.id ? { anchor: attrs.id } : {}),
      ...(node.name !== "p"
        ? { level: node.name, text: textContent(node) }
        : {}),
    });
  if (
    node.name === "a" &&
    simpleAttributes(node, ["href", "class", "aria-label", "target", "rel"])
  ) {
    const children = elements(node.children || []);
    if (
      children.length === 1 &&
      children[0].name === "img" &&
      simpleAttributes(children[0], ["src", "alt", "loading"])
    )
      return native(id, "core/image", {
        source: "url",
        url: children[0].attribs.src,
        alt: children[0].attribs.alt || "",
        link: attrs.href,
        classes: attrs.class || "",
        size: "full",
      });
    const arrow = children.find(
      (child) =>
        child.name === "span" && /^[↗→↓]$/.test(textContent(child).trim()),
    );
    if (children.every((child) => child.type === "text" || child === arrow)) {
      const raw = children
        .filter((child) => child !== arrow)
        .map(textContent)
        .join("")
        .trim();
      const suffix = raw.match(/\s*([↗→↓])$/)?.[1];
      const glyph = arrow ? textContent(arrow).trim() : suffix;
      return native(id, "core/button", {
        text: suffix ? raw.slice(0, -suffix.length).trim() : raw,
        href: attrs.href,
        classes: attrs.class || "",
        newTab: attrs.target === "_blank",
        ...(glyph
          ? {
              iconName:
                glyph === "↗"
                  ? "arrow-up-right"
                  : glyph === "↓"
                    ? "arrow-down"
                    : "arrow-right",
              iconPosition: "after",
              iconSize: 16,
            }
          : {}),
      });
    }
  }
  if (node.name === "nav" && simpleAttributes(node, ["class", "aria-label"])) {
    const items = elements(node.children || []).map((child, index) =>
      convert(child, `${id}_item_${index}`),
    );
    if (items.length && items.every((child) => child?.type === "core/button"))
      return native(
        id,
        "core/menu",
        {
          menuLabel: attrs["aria-label"] || "Portfolio navigation",
          classes: attrs.class || "",
          automaticPages: false,
          mobileMode: "expanded",
          orientation: "horizontal",
        },
        items.map((child) => {
          if (child.settings.iconName || child.settings.classes) return child;
          return native(child.id, "core/menu-item", {
            label: child.settings.text,
            href: child.settings.href,
          });
        }),
      );
  }
  // Footer links use paragraph wrappers solely for vertical spacing.
  if (node.name === "p" && !Object.keys(attrs).length) return undefined;
  return undefined;
}

/** Preserve authored copy/settings/IDs; unsupported custom markup stays Formatted HTML. */
export function upgradeGlasseyNativeBlocks(document) {
  let changed = false;
  const visit = (node) => {
    for (const child of node.children || []) visit(child);
    if (
      !["core/rich-text", "core/html"].includes(node.type) ||
      typeof node.settings?.html !== "string"
    )
      return;
    const roots = elements(parseDocument(node.settings.html).children);
    const converted = roots.map((root, index) => {
      // A standalone linked paragraph can be represented by a native Button.
      const children = elements(root.children || []);
      const link =
        root.name === "p" &&
        !Object.keys(root.attribs || {}).length &&
        children.length === 1 &&
        children[0].name === "a";
      return convert(link ? children[0] : root, `${node.id}_native_${index}`);
    });
    if (!converted.length || converted.some((entry) => !entry)) return;
    const { html, ...settings } = node.settings;
    if (converted.length === 1) {
      const replacement = converted[0];
      node.type = replacement.type;
      node.settings = {
        ...replacement.settings,
        ...settings,
        classes: classes(settings.classes, replacement.settings.classes),
      };
      if (replacement.children) node.children = replacement.children;
      else delete node.children;
    } else {
      node.type = "core/group";
      node.settings = settings;
      node.children = converted;
    }
    changed = true;
  };
  [
    ...Object.values(document.templates || {}),
    ...Object.values(document.parts || {}),
  ].forEach(visit);
  if (changed && !(document.css || "").includes("/* Glassey native blocks */"))
    document.css = (document.css || "") + GLASSEY_NATIVE_CSS;
  if (changed) delete document.compiled;
  return document;
}

const GLASSEY_NATIVE_CSS = `
/* Glassey native blocks */
.theme-root .c27-project-image figure{margin:0;height:100%}
.theme-root .c27-availability>p{display:flex;align-items:center;gap:8px;margin:0}
.theme-root :is(.c27-tags,.c27-small-label,.c27-editable-note,.c27-project-number,.c27-hero-eyebrow,.c27-hero-footnote)>p{font-size:inherit!important;color:inherit!important;letter-spacing:inherit;line-height:inherit}
.theme-root .c27-links .theme-button:where(:not(.c27-cta,.c27-secondary,.c27-nav-contact)){border:0;border-radius:0;background:none;padding:0;font:inherit;color:inherit;justify-content:space-between}
.theme-root .c27-project-info .c27-links .theme-button{padding-top:12px}
.theme-root .theme-button.c27-cta{border:0;justify-content:space-between}
.theme-root .theme-button.c27-secondary{border:0;border-radius:0;background:none}
.theme-root .c27-header-inner .theme-menu-items{gap:32px}
.theme-root .c27-header-inner .theme-button.c27-nav-contact{font-size:12px;gap:8px}
.theme-root .c27-footer .c27-links>.theme-button{display:flex;margin-bottom:18px}
@media(max-width:850px){.theme-root .c27-header-inner .theme-menu-items{gap:18px}}
@media(max-width:600px){.theme-root .c27-header-inner .theme-menu-items{gap:14px}.theme-root .c27-header-inner .theme-menu-items>:nth-child(2),.theme-root .c27-header-inner .theme-menu-items>:nth-child(3){display:none}.theme-root .c27-header-inner .theme-button.c27-nav-contact{padding:7px 10px;font-size:11px}}
`;
