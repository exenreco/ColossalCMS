import sanitizeHtml from "sanitize-html";
import postcss from "postcss";
import { parseDocument } from "htmlparser2";
import { textContent } from "domutils";
import semver from "semver";
import definitions from "../shared/theme-blocks.json" with { type: "json" };
import { fail } from "./v2-utils.mjs";
import { ADS_BLOCK, GOOGLE_ADS_ID, resolveAdUnit } from "./google-ads.mjs";
export const CMS_VERSION = "0.0.1",
  CORE_THEME_ID = "com.colossal.theme.default";
export const TYPES = ["home", "page", "post", "post-index", "search", "404"];
export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const safePath = (p) =>
  typeof p === "string" &&
  p.length > 0 &&
  p.length < 240 &&
  !p.startsWith("/") &&
  !p.includes("\\") &&
  !p.includes(":") &&
  !p.split("/").some((s) => s === ".." || s === "." || !s) &&
  !/[\x00-\x1f]/.test(p);
const color = (v) => (/^#[a-f0-9]{3,8}$/i.test(v || "") ? v : "");
const projectImage = (entry) => {
  const src = entry?.details?.panelData?.projectImageUrl;
  let remote = false;
  try {
    const url = new URL(src);
    remote = url.protocol === "https:" && !url.username && !url.password;
  } catch {
    // Relative bundled paths are checked below.
  }
  if (!remote) return "";
  return `<img src="${esc(src)}" alt="${esc(entry.title || "Project image")}" loading="lazy">`;
};
const num = (v, min = 0, max = 240) =>
  Math.max(min, Math.min(max, Number(v) || 0));
const cssLength = (value, min = 0, max = 240) => {
  if (typeof value === "number") return `${num(value, min, max)}px`;
  const match = String(value ?? "").match(
    /^(-?\d{1,4}(?:\.\d{1,2})?)(px|rem|em|%|vw|vh)$/,
  );
  if (!match) return `${num(value, min, max)}px`;
  const unit = match[2];
  const limit = unit === "px" ? max : unit === "%" ? 1000 : 100;
  return `${num(match[1], min < 0 ? -limit : 0, limit)}${unit}`;
};
const timingMs = (value, fallback) => {
  const match = typeof value === "string" && value.match(/^(\d+(?:\.\d+)?)s$/);
  return num(match ? Number(match[1]) * 1000 : (value ?? fallback), 0, 3000);
};
const lengthCssPattern = String.raw`-?\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh)`;
const positiveLengthCssPattern = String.raw`\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh)`;
const tags = [
  "div",
  "section",
  "article",
  "main",
  "header",
  "footer",
  "aside",
  "nav",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "span",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "br",
  "hr",
  "blockquote",
  "pre",
  "code",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "figure",
  "figcaption",
  "audio",
  "video",
  "source",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "details",
  "summary",
];
const styles = {
  "*": {
    "font-family": [
      /^(monospace|'(?:Arial|Georgia|system-ui|Times New Roman|monospace)')$/,
    ],
    "font-size": [new RegExp(`^${positiveLengthCssPattern}$`)],
    "font-weight": [/^700$/],
    "font-style": [/^italic$/],
    "line-height": [new RegExp(`^${positiveLengthCssPattern}$`)],
    "text-indent": [new RegExp(`^${positiveLengthCssPattern}$`)],
    "text-decoration": [/^(underline|line-through|underline line-through)$/],
    color: [/^#[a-f0-9]{3,8}$/i],
    "background-color": [/^#[a-f0-9]{3,8}$/i],
    "text-align": [/^(left|center|right|justify)$/],
    "background-image": [
      /^(?:linear-gradient\(\d+(?:\.\d+)?deg,#[a-f0-9]{3,8},#[a-f0-9]{3,8}\)|radial-gradient\(circle,#[a-f0-9]{3,8},#[a-f0-9]{3,8}\))$/i,
      /^(?:linear-gradient\(\d+(?:\.\d+)?deg,|radial-gradient\(circle,)(?:#[a-f0-9]{3,8} \d{1,3}%,){1,7}#[a-f0-9]{3,8} \d{1,3}%\)$/i,
    ],
    padding: [
      new RegExp(
        `^(?:${positiveLengthCssPattern})(?: ${positiveLengthCssPattern}){3}$`,
      ),
    ],
    margin: [
      new RegExp(
        `^(?:auto|${lengthCssPattern})(?: (?:auto|${lengthCssPattern})){3}$`,
      ),
    ],
    border: [/^[0-9]+px (?:solid|dashed|dotted|double) #[a-f0-9]{3,8}$/i],
    "border-width": [
      new RegExp(
        `^(?:${positiveLengthCssPattern})(?: ${positiveLengthCssPattern}){3}$`,
      ),
    ],
    "border-style": [/^(?:(?:solid|dashed|dotted|double)(?: |$)){1,4}$/],
    "border-color": [/^(?:(?:#[a-f0-9]{3,8}|currentColor)(?: |$)){1,4}$/i],
    "border-radius": [
      new RegExp(
        `^(?:${positiveLengthCssPattern})(?: ${positiveLengthCssPattern}){3}$`,
      ),
    ],
    height: [/^[0-9]+(px|vh|rem)$/],
    "flex-direction": [/^(row|column)$/],
    "justify-content": [/^(flex-start|center|flex-end)$/],
    "max-width": [new RegExp(`^${positiveLengthCssPattern}$`)],
    display: [/^(grid|flex|block)$/],
    position: [/^(relative|absolute|fixed)$/],
    top: [new RegExp(`^${lengthCssPattern}$`)],
    right: [new RegExp(`^${lengthCssPattern}$`)],
    bottom: [new RegExp(`^${lengthCssPattern}$`)],
    left: [new RegExp(`^${lengthCssPattern}$`)],
    "z-index": [/^-?\d{1,4}$/],
    transform: [
      new RegExp(
        `^translate\\(${lengthCssPattern},${lengthCssPattern}\\) rotate\\(-?\\d+(?:\\.\\d+)?deg\\) scale\\(\\d+(?:\\.\\d+)?,\\d+(?:\\.\\d+)?\\)$`,
      ),
    ],
    flex: [/^\d+(?:\.\d+)? \d+(?:\.\d+)? (?:auto|\d+px|\d+%)$/],
    "flex-wrap": [/^(nowrap|wrap|wrap-reverse)$/],
    "flex-shrink": [/^\d+(?:\.\d+)?$/],
    gap: [new RegExp(`^${positiveLengthCssPattern}$`)],
    "grid-template-columns": [
      /^repeat\((?:[1-9]|1[0-2]), ?minmax\(0, ?1fr\)\)$/,
    ],
  },
};
/** Template markup is data. No scripts, frames, handlers, executable URLs or external CSS resources survive. */
export function sanitizeTemplate(
  html,
  report = [],
  label = "template",
  rendered = false,
) {
  const original = String(html);
  if (original.length > 500000) fail("Template exceeds 500 KB.");
  const output = sanitizeHtml(original, {
    allowedTags: [...tags, ...(rendered ? ["form", "input", "button"] : [])],
    allowedAttributes: {
      "*": [
        "class",
        "id",
        "title",
        "role",
        "aria-roledescription",
        "style",
        "data-block-id",
        "data-theme-template",
        "data-theme-id",
        "aria-label",
        "aria-hidden",
        "data-model-url",
        "data-controls",
        "data-auto-rotate",
        "data-rotate-speed",
        "data-scroll-interactive",
        "data-scroll-strength",
        "data-camera-zoom",
        "data-google-ad-client",
        "data-google-ad-slot",
        "data-google-ad-format",
        "data-google-ad-sizing",
        "data-google-ad-width",
        "data-google-ad-height",
        "data-lazy-load",
        "data-swiper-per-view",
        "data-swiper-gap",
        "data-swiper-speed",
        "data-swiper-effect",
        "data-swiper-loop",
        "data-swiper-autoplay",
        "data-swiper-delay",
        "tabindex",
      ],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      audio: ["src", "controls", "preload", "autoplay", "loop", "muted"],
      video: [
        "src",
        "controls",
        "preload",
        "poster",
        "autoplay",
        "loop",
        "muted",
        "playsinline",
      ],
      source: ["src", "type"],
      ol: ["start"],
      form: ["action", "method", "role"],
      input: ["type", "name", "value", "placeholder", "aria-label"],
      button: ["type"],
    },
    allowedStyles: styles,
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tag, attrs) => ({
        tagName: tag,
        attribs: { ...attrs, target: "_self", rel: "noopener noreferrer" },
      }),
      form: () => ({
        tagName: "form",
        attribs: { action: "/search", method: "get", role: "search" },
      }),
      input: (tag, a) =>
        a.type === "hidden" && a.name === "themePreview"
          ? {
              tagName: tag,
              attribs: {
                type: "hidden",
                name: "themePreview",
                value: a.value || "",
              },
            }
          : {
              tagName: tag,
              attribs: {
                type: "search",
                name: "q",
                value: a.value || "",
                placeholder: a.placeholder || "Search",
                "aria-label": "Search content",
              },
            },
    },
    parser: { lowerCaseTags: true },
  });
  if (output !== original)
    report.push(
      label + ": unsafe or unsupported markup removed; HTML normalized.",
    );
  return output;
}
export function sanitizeCss(css, report = []) {
  if (String(css).length > 200000) fail("Theme styles exceed 200 KB.");
  const allowed = new Set([
    "color",
    "background-color",
    "background-image",
    "backdrop-filter",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "line-height",
    "letter-spacing",
    "text-align",
    "text-decoration",
    "display",
    "grid-template-columns",
    "grid-column",
    "gap",
    "column-gap",
    "row-gap",
    "align-items",
    "justify-content",
    "flex-wrap",
    "flex-direction",
    "padding",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "margin",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "width",
    "max-width",
    "min-width",
    "height",
    "min-height",
    "max-height",
    "border",
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "z-index",
    "scroll-margin-top",
    "border-radius",
    "border-color",
    "border-width",
    "border-style",
    "box-shadow",
    "object-fit",
    "overflow",
    "list-style",
    "opacity",
  ]);
  let ast;
  try {
    ast = postcss.parse(String(css));
  } catch {
    fail("Theme CSS could not be parsed.");
  }
  ast.walkAtRules((rule) => {
    if (
      rule.name !== "media" ||
      !/^\s*\(?[\w\s():.\-]+\)?\s*$/.test(rule.params)
    ) {
      report.push("Removed CSS @" + rule.name);
      rule.remove();
    }
  });
  ast.walkDecls((d) => {
    if (
      !allowed.has(d.prop.toLowerCase()) ||
      (d.prop.toLowerCase() === "position" && d.value !== "sticky") ||
      /[{}<>\\]|url\s*\(|expression\s*\(|@|javascript|behavior|var\s*\(/i.test(
        d.value,
      )
    ) {
      report.push("Removed CSS declaration " + d.prop);
      d.remove();
    }
  });
  ast.walkRules((r) => {
    if (!/^[\w\s.#,:>+*()\[\]="^$|~-]+$/.test(r.selector)) {
      r.remove();
      report.push("Removed unsupported CSS selector");
      return;
    }
    r.selector = r.selector
      .split(",")
      .map((s) =>
        s.trim().startsWith(".theme-root")
          ? s.trim()
          : ".theme-root " + s.trim().replace(/^(html|body|:root)\b/, ""),
      )
      .join(",");
  });
  return ast.toString();
}
export function validateThemeManifest(m, files, core = false) {
  if (
    !m ||
    !/^([a-z][a-z0-9-]*\.)+[a-z][a-z0-9-]*$/.test(m.id || "") ||
    m.id.length > 120
  )
    fail("Use a reverse-domain theme ID.");
  if (!core && (m.isCore || m.id === CORE_THEME_ID))
    fail("An uploaded theme cannot replace the core theme.");
  for (const k of ["name", "description", "author", "license"])
    if (typeof m[k] !== "string" || !m[k].trim() || m[k].length > 500)
      fail("Theme " + k + " is required.");
  if (
    !semver.valid(m.version) ||
    !semver.validRange(m.requires?.colossal) ||
    !semver.satisfies(CMS_VERSION, m.requires.colossal)
  )
    fail("Theme requires an incompatible Colossal version.");
  if (
    !Array.isArray(m.templates) ||
    !m.templates.length ||
    m.templates.length > 30 ||
    m.templates.filter((t) => t.isDefault === true).length !== 1
  )
    fail("A theme must declare exactly one default template.");
  const ids = new Set(),
    typeDefaults = new Set();
  for (const t of m.templates) {
    if (
      !/^[a-z][a-z0-9-]*$/.test(t.id || "") ||
      ids.has(t.id) ||
      typeof t.name !== "string" ||
      !t.name.trim() ||
      !Array.isArray(t.appliesTo) ||
      !t.appliesTo.length ||
      t.appliesTo.some((a) => !TYPES.includes(a))
    )
      fail("Invalid or duplicate template definition.");
    ids.add(t.id);
    if (t.isTypeDefault)
      for (const type of t.appliesTo) {
        if (typeDefaults.has(type))
          fail("Only one type default is allowed for " + type);
        typeDefaults.add(type);
      }
  }
  if (
    !m.parts ||
    typeof m.parts !== "object" ||
    Array.isArray(m.parts) ||
    Object.keys(m.parts).some(
      (p) => !["header", "footer", "sidebar", "content"].includes(p),
    )
  )
    fail("Theme parts may be header, footer, sidebar or content.");
  if (
    (semver.lt(m.version, "1.0.0") || semver.gte(m.version, "2.0.5")) &&
    ["header", "footer", "sidebar", "content"].some((name) => !m.parts[name])
  )
    fail("Themes must declare header, footer, sidebar and content parts.");
  if (!Array.isArray(m.blocks) || m.blocks.length > 50)
    fail("Invalid theme blocks.");
  // v2.0.2: every block declares a unique icon, used by the library and canvas.
  const blockIcons = new Map();
  for (const b of m.blocks) {
    if (!/^([a-z][a-z0-9-]*)\/[a-z][a-z0-9-]*$/.test(b.type || ""))
      fail("Invalid theme blocks.");
    if (typeof b.icon !== "string" || !b.icon.trim() || b.icon.length > 80)
      fail("Every theme block must declare an icon.");
    if (blockIcons.has(b.icon))
      fail(
        "Block icons must be unique within a theme: “" +
          b.type +
          "” reuses the icon of “" +
          blockIcons.get(b.icon) +
          "”.",
      );
    blockIcons.set(b.icon, b.type);
  }
  if (
    !m.assets ||
    !Array.isArray(m.assets.styles) ||
    !Array.isArray(m.assets.scripts) ||
    m.assets.styles.length > 30 ||
    m.assets.scripts.length > 30
  )
    fail("Theme assets must declare styles and scripts arrays.");
  const paths = [
    ...m.templates.map((t) => t.file),
    ...Object.values(m.parts),
    ...m.blocks.map((b) => b.file),
    ...(m.assets?.styles || []),
    ...(m.assets?.scripts || []),
  ];
  for (const p of paths)
    if (!safePath(p) || (files && !Object.hasOwn(files, p)))
      fail("Theme file is missing or unsafe: " + p);
  if (
    m.palette &&
    (!Array.isArray(m.palette) ||
      m.palette.length > 12 ||
      m.palette.some((c) => !color(c)))
  )
    fail("Use up to 12 hex colors in the palette.");
  return m;
}
const block = (type, settings = {}, children) => ({
  id: "blk_" + crypto.randomUUID(),
  type,
  settings,
  ...(children ? { children } : {}),
});
const container = (children) =>
  block(
    "core/container",
    { padding: { top: 40, right: 32, bottom: 40, left: 32 }, maxWidth: 1080 },
    children,
  );
const part = (name) => block("theme/part-" + name);
export function defaultTheme() {
  const templates = [
    {
      id: "home",
      name: "Home",
      file: "templates/home.html",
      isTypeDefault: true,
      appliesTo: ["home"],
    },
    {
      id: "default",
      name: "Page",
      file: "templates/default.html",
      isDefault: true,
      appliesTo: ["page", "post"],
    },
    {
      id: "full-width",
      name: "Full Width",
      file: "templates/full-width.html",
      appliesTo: ["page"],
    },
    {
      id: "post-single",
      name: "Single",
      file: "templates/post-single.html",
      isTypeDefault: true,
      appliesTo: ["post"],
    },
    {
      id: "post-archive",
      name: "Posts",
      file: "templates/post-archive.html",
      isTypeDefault: true,
      appliesTo: ["post-index"],
    },
    {
      id: "search",
      name: "Search",
      file: "templates/search.html",
      isTypeDefault: true,
      appliesTo: ["search"],
    },
    {
      id: "not-found",
      name: "404",
      file: "templates/not-found.html",
      isTypeDefault: true,
      appliesTo: ["404"],
    },
  ];
  const article = () => [
    block("core/heading", { text: "{{content.title}}", level: "h1" }),
    block("core/rich-text", { html: "<p>{{content.excerpt}}</p>" }),
    block("core/post-meta"),
    block("core/featured-image"),
    part("content"),
  ];
  const roots = {
    home: article(),
    default: article(),
    "full-width": article(),
    "post-single": article(),
    "post-archive": [
      block("core/heading", { text: "{{site.tagline}}", level: "h1" }),
      block("core/post-list", { limit: 6, columns: 3, showExcerpt: true }),
      block("core/pagination"),
    ],
    search: [
      block("core/heading", { text: "Search the journal", level: "h1" }),
      block("core/search"),
      block("core/post-list", { limit: 6, columns: 2, showExcerpt: true }),
      block("core/pagination"),
    ],
    "not-found": [
      block("core/heading", {
        text: "{{content.title}}",
        level: "h1",
      }),
      part("content"),
      block("core/rich-text", {
        html: '<p>The page may have moved or is not published. <a href="/">Return home</a>.</p>',
      }),
    ],
  };
  const doc = {
    manifest: {
      id: CORE_THEME_ID,
      name: "Colossal Default",
      version: CMS_VERSION,
      author: "Colossal Core Team",
      description:
        "A considered space for your stories. Clean typography, warm colors, and room to grow.",
      license: "MIT",
      isCore: true,
      requires: { colossal: ">=0.0.1" },
      templates,
      parts: {
        header: "parts/header.html",
        footer: "parts/footer.html",
        sidebar: "parts/sidebar.html",
        content: "parts/content.html",
      },
      blocks: definitions
        .filter((b) => !b.legacy)
        .map((b) => ({
          type: b.type,
          file: "blocks/" + b.type.split("/")[1] + ".html",
          icon: b.icon,
        })),
      assets: { styles: ["assets/theme.css"], scripts: [] },
      palette: ["#214c3a", "#f6f8f1", "#d2debd", "#596f53", "#ffffff"],
    },
    templates: {},
    parts: {
      header: container([block("core/site-brand"), block("core/menu")]),
      footer: container([
        block("core/rich-text", {
          html: "<p>{{site.title}} · Powered by Colossal</p>",
        }),
      ]),
      sidebar: container([block("core/search")]),
      content: container([block("core/content")]),
    },
    blocks: [],
    html: {},
    assets: {},
    css: ".theme-root h1{font-family:Georgia,serif;font-size:clamp(32px,5vw,62px);font-weight:400;line-height:1.15;letter-spacing:-1.5px}.theme-root a{color:#246b50}.theme-root{color:#243e2f;background-color:#f7f9f3;font-family:system-ui;line-height:1.8}.theme-root .theme-part-header{border-bottom:1px solid #dce4d3}.theme-root .theme-part-footer{border-top:1px solid #dce4d3;color:#6c7d62}",
  };
  for (const t of templates)
    doc.templates[t.id] = block("core/container", {}, [
      part("header"),
      container(roots[t.id]),
      part("footer"),
    ]);
  doc.templates["full-width"].children[1].settings.maxWidth = 1600;
  return compileDocument(doc);
}
export function resolveTemplateForContent(theme, kind, templateId) {
  const list = theme?.manifest?.templates || [];
  const valid = (t) => !!theme?.templates?.[t.id];
  const override = list.find(
    (t) => t.id === templateId && t.appliesTo.includes(kind) && valid(t),
  );
  const chosen =
    override ||
    list.find(
      (t) => t.isTypeDefault && t.appliesTo.includes(kind) && valid(t),
    ) ||
    list.find((t) => t.isDefault && valid(t));
  return {
    template: chosen || null,
    source: override
      ? "content"
      : chosen?.isTypeDefault
        ? "type"
        : chosen
          ? "theme"
          : "core",
    warning:
      templateId && !override
        ? "The assigned template “" +
          templateId +
          "” is unavailable for this content. Falling back to “" +
          (chosen?.name || "Core fallback") +
          "”."
        : "",
  };
}
/** Validate trees at the persistence boundary, including nesting, part references and bounded settings. */
export function validateDocument(input, core = false) {
  if (!input || typeof input !== "object") fail("Invalid theme document.");
  const d = structuredClone(input);
  validateThemeManifest(d.manifest, null, core);
  if (
    !d.templates ||
    !d.parts ||
    !Array.isArray(d.blocks) ||
    d.blocks.length > 50
  )
    fail("Invalid theme document.");
  const customTypes = new Set();
  for (const b of d.blocks) {
    if (
      !/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/.test(b.type) ||
      b.type.startsWith("core/") ||
      customTypes.has(b.type)
    )
      fail("Invalid custom block type.");
    customTypes.add(b.type);
    if (typeof b.icon !== "string" || !b.icon.trim()) b.icon = "fas fa-block";
    b.template = sanitizeTemplate(b.template || "");
    if (!Array.isArray(b.fields) || b.fields.length > 30)
      fail("Invalid custom block fields.");
    for (const f of b.fields)
      if (
        !/^[a-zA-Z][a-zA-Z0-9]*$/.test(f.key) ||
        ![
          "text",
          "textarea",
          "number",
          "select",
          "checkbox",
          "image",
          "media",
        ].includes(f.type)
      )
        fail("Invalid custom block field.");
  }
  const allowed = new Set([
    ...definitions.map((b) => b.type),
    ...customTypes,
    "core/html",
    ...Object.keys(d.manifest.parts).map((k) => "theme/part-" + k),
  ]);
  let total = 0;
  const walk = (node, depth, partMode, ids, parentType) => {
    if (++total > 2000 || depth > 8)
      fail(
        "Theme blocks exceed the maximum nesting depth of 8 or total block limit.",
      );
    if (
      !node ||
      !allowed.has(node.type) ||
      typeof node.id !== "string" ||
      ids.has(node.id)
    )
      fail("Invalid block or duplicate block ID.");
    ids.add(node.id);
    if (
      !node.settings ||
      typeof node.settings !== "object" ||
      Array.isArray(node.settings) ||
      JSON.stringify(node.settings).length > 100000
    )
      fail("Invalid block settings.");
    if (
      node.type.startsWith("theme/part-") &&
      !d.parts[node.type.replace("theme/part-", "")]
    )
      fail("Unknown shared part.");
    if (node.type === "core/column" && parentType !== "core/columns")
      fail("Column blocks can only be placed inside a Columns block.");
    if (node.type === "core/slide" && parentType !== "core/slider")
      fail("Slide blocks can only be placed inside a Slider.");
    if (
      node.type === "core/overlay" &&
      !["core/slide", "core/gltf"].includes(parentType)
    )
      fail("Overlay blocks can only be placed inside a Slide or 3D model.");
    if (
      node.type === "core/columns" &&
      node.children?.some((c) => c.type !== "core/column")
    )
      fail("Columns accepts Column blocks only.");
    if (
      node.type === "core/slider" &&
      node.children?.some((c) => c.type !== "core/slide")
    )
      fail("Slider accepts Slide blocks only.");
    if (
      node.type === "core/gltf" &&
      node.children?.some((c) => c.type !== "core/overlay")
    )
      fail("3D model accepts Overlay blocks only.");
    if (node.settings.html)
      node.settings.html = sanitizeTemplate(node.settings.html);
    if (node.type === "core/gltf") {
      if (!String(node.settings.alt || "").trim())
        fail("Add a description for the 3D model.");
      if (node.settings.source === "url") {
        let url;
        try {
          url = new URL(node.settings.url);
        } catch {
          fail("Enter a valid HTTPS model URL.");
        }
        if (url.protocol !== "https:" || url.username || url.password)
          fail("Model URLs must use HTTPS without credentials.");
      }
    }
    if (
      ["core/image", "core/media"].includes(node.type) &&
      node.settings.source === "url"
    ) {
      let url;
      try {
        url = new URL(node.settings.url);
      } catch {
        fail("Enter a valid HTTPS media URL.");
      }
      if (url.protocol !== "https:" || url.username || url.password)
        fail("Media URLs must use HTTPS without credentials.");
    }
    if (node.type === "core/slide" && node.settings.backgroundUrl) {
      let url;
      try {
        url = new URL(node.settings.backgroundUrl);
      } catch {
        fail("Enter a valid HTTPS slide background URL.");
      }
      if (url.protocol !== "https:" || url.username || url.password)
        fail("Slide background URLs must use HTTPS without credentials.");
    }
    if (node.children) {
      if (
        !Array.isArray(node.children) ||
        (![
          "core/container",
          "core/columns",
          "core/column",
          "core/group",
          "core/row",
          "core/slider",
          "core/slide",
          "core/overlay",
          "core/gltf",
        ].includes(node.type) &&
          !d.blocks.find((b) => b.type === node.type)?.container)
      )
        fail("Only layout blocks can have children.");
      node.children.forEach((n) =>
        walk(n, depth + 1, partMode, ids, node.type),
      );
    }
    return node;
  };
  for (const t of d.manifest.templates) {
    const root = d.templates[t.id];
    if (root?.type !== "core/container")
      fail("Every template needs a root container.");
    walk(root, 0, false, new Set());
  }
  for (const name of Object.keys(d.manifest.parts)) {
    if (d.parts[name]?.type !== "core/container")
      fail("Each theme part needs a root container.");
    walk(d.parts[name], 0, true, new Set());
  }
  const checkParts = (node, trail = []) => {
    if (node.type.startsWith("theme/part-")) {
      const name = node.type.slice(11);
      if (trail.includes(name))
        fail("Shared parts cannot contain circular references.");
      checkParts(d.parts[name], [...trail, name]);
    }
    for (const child of node.children || []) checkParts(child, trail);
  };
  for (const [name, root] of Object.entries(d.parts)) checkParts(root, [name]);
  d.css = sanitizeCss(d.css || "");
  d.html = {};
  d.assets = d.assets || {};
  d.manifest.assets.scripts = [];
  return compileDocument(d);
}
function styleSettings(s) {
  let css = "";
  for (const name of ["margin", "padding"])
    if (s[name])
      css +=
        name +
        ":" +
        ["top", "right", "bottom", "left"]
          .map((k) =>
            s[name][k] === "auto"
              ? name === "margin"
                ? "auto"
                : "0px"
              : cssLength(s[name][k], name === "margin" ? -240 : 0, 240),
          )
          .join(" ") +
        ";";
  if (color(s.color)) css += "color:" + s.color + ";";
  if (
    ["Arial", "Georgia", "system-ui", "Times New Roman", "monospace"].includes(
      s.fontFamily,
    )
  )
    css += "font-family:'" + s.fontFamily + "';";
  if (s.fontSize) css += "font-size:" + cssLength(s.fontSize, 8, 96) + ";";
  if (s.lineHeight)
    css += "line-height:" + cssLength(s.lineHeight, 10, 160) + ";";
  if (s.textIndent)
    css += "text-indent:" + cssLength(s.textIndent, 0, 120) + ";";
  if (s.bold) css += "font-weight:700;";
  if (s.italic) css += "font-style:italic;";
  if (s.inlineCode) css += "font-family:monospace;";
  if (s.underline || s.strike)
    css +=
      "text-decoration:" +
      [s.underline ? "underline" : "", s.strike ? "line-through" : ""]
        .filter(Boolean)
        .join(" ") +
      ";";
  if (color(s.background)) css += "background-color:" + s.background + ";";
  const gradient = s.backgroundGradient;
  const stops = Array.isArray(gradient?.stops)
    ? gradient.stops
        .slice(0, 8)
        .filter((stop) => color(stop?.color))
        .map((stop) => ({
          color: stop.color,
          position: num(stop.position, 0, 100),
        }))
        .sort((a, b) => a.position - b.position)
    : [];
  if (stops.length >= 2) {
    const colors = stops
      .map((stop) => `${stop.color} ${stop.position}%`)
      .join(",");
    css +=
      gradient.type === "radial"
        ? `background-image:radial-gradient(circle,${colors});`
        : `background-image:linear-gradient(${num(gradient.angle ?? 90, 0, 360)}deg,${colors});`;
  } else if (gradient && color(gradient.start) && color(gradient.end))
    css +=
      gradient.type === "radial"
        ? `background-image:radial-gradient(circle,${gradient.start},${gradient.end});`
        : `background-image:linear-gradient(${num(gradient.angle ?? 90, 0, 360)}deg,${gradient.start},${gradient.end});`;
  if (["left", "center", "right", "justify"].includes(s.align))
    css += "text-align:" + s.align + ";";
  const borderStyle = ["solid", "dashed", "dotted", "double"].includes(
    s.borderStyle,
  )
    ? s.borderStyle
    : "solid";
  if (s.borderSides || s.borderColors || s.borderStyles) {
    const sides = ["top", "right", "bottom", "left"];
    css +=
      "border-width:" +
      sides
        .map((side) =>
          cssLength(
            s.borderSides?.[side] === "auto"
              ? 0
              : (s.borderSides?.[side] ?? s.borderWidth ?? 0),
            0,
            20,
          ),
        )
        .join(" ") +
      ";border-style:" +
      sides
        .map((side) =>
          ["solid", "dashed", "dotted", "double"].includes(
            s.borderStyles?.[side],
          )
            ? s.borderStyles[side]
            : borderStyle,
        )
        .join(" ") +
      ";border-color:" +
      sides
        .map(
          (side) =>
            color(s.borderColors?.[side]) ||
            color(s.borderColor) ||
            "currentColor",
        )
        .join(" ") +
      ";";
  } else if (color(s.borderColor) && s.borderWidth)
    css +=
      "border:" +
      num(s.borderWidth, 0, 20) +
      "px " +
      borderStyle +
      " " +
      s.borderColor +
      ";";
  if (s.radiusCorners)
    css +=
      "border-radius:" +
      ["topLeft", "topRight", "bottomRight", "bottomLeft"]
        .map((corner) => cssLength(s.radiusCorners[corner], 0, 100))
        .join(" ") +
      ";";
  else if (s.radius) css += "border-radius:" + num(s.radius, 0, 100) + "px;";
  if (s.maxWidth && s.maxWidth !== "auto" && !s.fullBleed)
    css += "max-width:" + cssLength(s.maxWidth, 0, 1920) + ";margin:0 auto;";
  if (["stretch", "flex-start", "center", "flex-end"].includes(s.verticalAlign))
    css +=
      "display:flex;flex-direction:column;justify-content:" +
      (s.verticalAlign === "stretch" ? "flex-start" : s.verticalAlign) +
      ";";
  if (["block", "flex", "grid"].includes(s.display))
    css += "display:" + s.display + ";";
  if (s.display === "grid" && s.gridColumns)
    css += `grid-template-columns:repeat(${num(s.gridColumns, 1, 12)},minmax(0,1fr));`;
  if (["relative", "absolute", "fixed"].includes(s.position)) {
    css += "position:" + s.position + ";";
    for (const side of ["top", "right", "bottom", "left"])
      if (s.offsets?.[side] !== undefined && s.offsets[side] !== "auto")
        css += side + ":" + cssLength(s.offsets[side], -500, 500) + ";";
  }
  if (s.zIndex !== null && s.zIndex !== undefined && s.zIndex !== "")
    css += "z-index:" + Math.round(num(s.zIndex, -100, 1000)) + ";";
  if (s.gap !== undefined) css += "gap:" + cssLength(s.gap, 0, 120) + ";";
  const transform = s.transform;
  if (
    transform &&
    typeof transform === "object" &&
    Object.keys(transform).length
  ) {
    css +=
      "transform:translate(" +
      cssLength(transform.translateX ?? 0, -500, 500) +
      "," +
      cssLength(transform.translateY ?? 0, -500, 500) +
      ") rotate(" +
      num(transform.rotate ?? 0, -360, 360) +
      "deg) scale(" +
      num(transform.scaleX ?? 1, 0, 10) +
      "," +
      num(transform.scaleY ?? 1, 0, 10) +
      ");";
  }
  if (
    typeof s.flex === "string" &&
    /^\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+(?:auto|\d+px|\d+%)$/.test(s.flex.trim())
  )
    css += "flex:" + s.flex.trim() + ";";
  if (["nowrap", "wrap", "wrap-reverse"].includes(s.flexWrap))
    css += "flex-wrap:" + s.flexWrap + ";";
  if (s.flexShrink !== undefined)
    css += "flex-shrink:" + num(s.flexShrink, 0, 10) + ";";
  return css;
}
/**
 * v2.0.2: Container min-height compiles to breakpoint-aware CSS rules keyed by
 * the block's stable id, keeps padding inside the box (`border-box`), and can
 * vertically centre content when enabled.
 */
export function minHeightCss(id, s, slider = false) {
  if (!s?.minHeightEnabled) return "";
  const unit = ["px", "vh", "rem", "em", "%", "vw"].includes(s.minHeightUnit)
    ? s.minHeightUnit
    : "px";
  const val = (n) => {
    if (n === "auto" || n === null || n === undefined || n === "") return "";
    if (
      typeof n === "string" &&
      /^\d{1,4}(?:\.\d{1,2})?(px|vh|rem|em|%|vw)$/.test(n)
    )
      return cssLength(n, 0, 4000);
    const v = Number(n);
    return Number.isFinite(v) && v > 0 ? Math.min(4000, v) + unit : "";
  };
  const selector = '[data-block-id="' + String(id).replace(/["\\]/g, "") + '"]';
  const target = slider ? selector + " > .cl-swiper" : selector;
  const align = ["flex-start", "center", "flex-end"].includes(s.verticalAlign)
    ? s.verticalAlign
    : "flex-start";
  let css = slider
    ? val(s.minHeight)
      ? target + "{min-height:" + val(s.minHeight) + ";}"
      : ""
    : selector +
      "{display:flex;flex-direction:column;justify-content:" +
      align +
      ";" +
      (val(s.minHeight) ? "min-height:" + val(s.minHeight) + ";" : "") +
      "}";
  const byBreakpoint = s.minHeightByBreakpoint || {};
  for (const [media, value] of [
    ["(min-width:1025px)", byBreakpoint.desktop],
    ["(min-width:641px) and (max-width:1024px)", byBreakpoint.tablet],
    ["(max-width:640px)", byBreakpoint.mobile],
  ]) {
    if (value === undefined) continue;
    const rule =
      value === null
        ? "min-height:auto;"
        : val(value)
          ? "min-height:" + val(value) + ";"
          : "";
    if (rule) css += "@media " + media + "{" + target + "{" + rule + "}}";
  }
  return css;
}
const token = (type, settings) =>
  "{{block:" +
  btoa(unescape(encodeURIComponent(JSON.stringify({ type, settings })))) +
  "}}";
export function compileBlock(b, d, depth = 0, asBody = false) {
  if (depth > 16) return "";
  const s = b.settings || {},
    children = (b.children || [])
      .map((n) => compileBlock(n, d, depth + 1))
      .join("");
  if (b.type.startsWith("theme/part-")) {
    const name = b.type.slice(11);
    return (
      '<div class="theme-part-' +
      name +
      '">' +
      compileBlock(d.parts[name], d, depth + 1) +
      "</div>"
    );
  }
  let html = "";
  const type = b.type;
  if (
    ["core/container", "core/group", "core/column", "core/overlay"].includes(
      type,
    )
  )
    html = children;
  else if (type === "core/slide")
    html = token("core/slide-background", { ...s, blockId: b.id }) + children;
  else if (type === "core/slider") {
    const height = num(s.height ?? 420, 120, 1600);
    const perView = num(s.slidesPerView ?? 1, 1, 6);
    const gap = num(s.spaceBetween ?? 0, 0, 120);
    const speed = num(s.speed ?? 400, 0, 3000);
    const delay = num(s.autoplayDelay ?? 5000, 500, 60000);
    const effect = s.effect === "fade" ? "fade" : "slide";
    html =
      `<div class="swiper cl-swiper" role="region" aria-roledescription="carousel" aria-label="${esc(s.ariaLabel || "Slider")}" data-swiper-per-view="${perView}" data-swiper-gap="${gap}" data-swiper-speed="${speed}" data-swiper-effect="${effect}" data-swiper-loop="${s.loop === true}" data-swiper-autoplay="${s.autoplay === true}" data-swiper-delay="${delay}" style="height:${height}px">` +
      `<div class="swiper-wrapper">${children}</div>` +
      (s.navigation === false
        ? ""
        : '<button class="swiper-button-prev" type="button" aria-label="Previous slide"></button><button class="swiper-button-next" type="button" aria-label="Next slide"></button>') +
      (s.pagination === false ? "" : '<div class="swiper-pagination"></div>') +
      "</div>";
  } else if (type === "core/row" || type === "core/columns") {
    const selector = '[data-block-id="' + esc(b.id) + '"] > .theme-layout';
    const align = ["stretch", "flex-start", "center", "flex-end"].includes(
      s.verticalAlign || s.alignItems,
    )
      ? s.verticalAlign || s.alignItems
      : "stretch";
    const widths = (b.children || [])
      .map((c) =>
        /^\d+(\.\d+)?fr$/.test(c.settings.width || "")
          ? c.settings.width
          : "1fr",
      )
      .join(" ");
    const display = ["block", "flex", "grid"].includes(s.display)
      ? s.display
      : type === "core/row"
        ? "flex"
        : "grid";
    let css = `${selector}{display:${display};gap:${cssLength(s.gap ?? 24, 0, 120)};align-items:${align};`;
    if (display === "grid" && s.gridColumns)
      css += `grid-template-columns:repeat(${num(s.gridColumns, 1, 12)},minmax(0,1fr));`;
    else if (type === "core/columns" && display === "grid")
      css += `grid-template-columns:${widths || "1fr"};`;
    if (display === "flex")
      css += `flex-wrap:${["nowrap", "wrap", "wrap-reverse"].includes(s.flexWrap) ? s.flexWrap : s.wrap === false ? "nowrap" : "wrap"};justify-content:${["flex-start", "center", "flex-end", "space-between"].includes(s.justify) ? s.justify : "flex-start"};`;
    css += "}";
    if (type === "core/columns" && s.stackOnMobile !== false)
      css += `@media(max-width:640px){${selector}{display:flex;flex-direction:${s.reverseOnMobile ? "column-reverse" : "column"};}}`;
    d._gen?.push(css);
    html =
      '<div class="theme-layout">' +
      (children || (type === "core/columns" ? "<p>Add a Column.</p>" : "")) +
      "</div>";
  } else if (type === "core/spacer")
    html =
      '<div style="height:' +
      num(s.height || 48, 0, 400) +
      (["px", "vh", "rem"].includes(s.unit) ? s.unit : "px") +
      '"></div>';
  else if (type === "core/heading") {
    const level = /^h[1-6]$/.test(s.level) ? s.level : "h2";
    html =
      "<" +
      level +
      ">" +
      (s.html ? sanitizeTemplate(s.html) : esc(s.text)) +
      "</" +
      level +
      ">";
  } else if (type === "core/rich-text" || type === "core/html")
    html = sanitizeTemplate(s.html || "");
  else if (type === "core/gltf") html = token(type, s) + children;
  else if (definitions.some((x) => x.type === type)) html = token(type, s);
  else {
    const def = d.blocks.find((x) => x.type === type);
    html = (def?.template || "")
      .replace(/{{setting\.([\w]+)}}/g, (_, k) => esc(s[k]))
      .replaceAll("{{children}}", children);
  }
  const classes = String(s.classes || "")
    .split(/\s+/)
    .filter((c) => /^[a-zA-Z][\w-]*$/.test(c))
    .join(" ");
  const hidden = ["desktop", "tablet", "mobile"]
    .filter((k) => s.visibility?.[k] === false)
    .map((k) => "theme-hide-" + k)
    .join(" ");
  const structural =
    type === "core/slide"
      ? "swiper-slide"
      : type === "core/overlay"
        ? "cl-overlay-block"
        : type === "core/gltf"
          ? "cl-gltf-block"
          : "";
  if (d._gen && s.minHeightEnabled)
    d._gen.push(minHeightCss(b.id, s, type === "core/slider"));
  if (d._gen && /^[\w-]+$/.test(b.id)) {
    const selector = `[data-block-id="${b.id}"]`;
    const linkStates = {
      Link: "",
      Active: ":active",
      Visited: ":visited",
      Hover: ":hover",
    };
    for (const [state, suffix] of Object.entries(linkStates))
      if (color(s.linkColors?.[state]))
        d._gen.push(`${selector} a${suffix}{color:${s.linkColors[state]};}`);
    if (["none", "underline"].includes(s.linkDecoration))
      d._gen.push(`${selector} a{text-decoration:${s.linkDecoration};}`);
    const events = { load: "", hover: ":hover", focus: ":focus-within" };
    for (const phase of ["In", "Working", "Out"]) {
      const animation = s.animations?.[phase];
      if (!animation || !["fade", "slide", "scale"].includes(animation.preset))
        continue;
      const event = events[animation.event || "load"];
      if (event === undefined) continue;
      const ease = [
        "ease",
        "linear",
        "ease-in",
        "ease-out",
        "cubic-bezier(.17,.67,.83,.67)",
      ].includes(animation.ease)
        ? animation.ease
        : "ease";
      const duration = timingMs(animation.duration, 500);
      const delay = timingMs(animation.delay, 0);
      if (type !== "core/slider")
        d._gen.push(
          `${selector}${event}{animation:cl-picker-${animation.preset} ${duration}ms ${ease} ${delay}ms ${animation.loop === true ? "infinite alternate" : "1 both"};}`,
        );
    }
  }
  if (asBody) return html;
  return (
    '<div data-block-id="' +
    esc(b.id) +
    '" class="theme-block ' +
    classes +
    " " +
    hidden +
    " " +
    structural +
    '"' +
    (/^[a-zA-Z][\w-]*$/.test(s.anchor || "")
      ? ' id="' + esc(s.anchor) + '"'
      : "") +
    ' style="' +
    styleSettings(s) +
    '">' +
    html +
    "</div>"
  );
}
export function compileDocument(d) {
  d.compiled = {};
  const generated = [];
  d._gen = generated;
  for (const t of d.manifest.templates)
    d.compiled[t.id] = compileBlock(d.templates[t.id], d, 0, true);
  delete d._gen;
  d.generatedCss = generated.join("");
  return d;
}
export function themeMediaIds(d) {
  const ids = new Set();
  const visit = (b) => {
    if (b?.settings?.mediaId) ids.add(b.settings.mediaId);
    if (b?.settings?.backgroundMediaId) ids.add(b.settings.backgroundMediaId);
    if (b?.settings?.poster) ids.add(b.settings.poster);
    b?.children?.forEach(visit);
  };
  Object.values(d?.templates || {}).forEach(visit);
  Object.values(d?.parts || {}).forEach(visit);
  return [...ids];
}
export function htmlToTree(html) {
  const dom = parseDocument(html);
  const convert = (n) => {
    if (n.type === "text")
      return n.data.trim()
        ? block("core/rich-text", { html: "<p>" + esc(n.data) + "</p>" })
        : null;
    if (!n.name) return null;
    const children = (n.children || []).map(convert).filter(Boolean);
    if (
      [
        "div",
        "section",
        "main",
        "article",
        "header",
        "footer",
        "aside",
      ].includes(n.name)
    )
      return block(
        "core/container",
        { classes: n.attribs?.class || "" },
        children,
      );
    if (/^h[1-6]$/.test(n.name))
      return block("core/heading", { text: textContent(n), level: n.name });
    // Sanitized hand-authored fragments remain editable through the HTML text field.
    const serialize = (node) => {
      if (node.type === "text") return esc(node.data);
      if (!node.name) return "";
      const attrs = Object.entries(node.attribs || {})
        .map(([k, v]) => " " + k + '="' + esc(v) + '"')
        .join("");
      return (
        "<" +
        node.name +
        attrs +
        ">" +
        (node.children || []).map(serialize).join("") +
        "</" +
        node.name +
        ">"
      );
    };
    return block("core/html", { html: serialize(n) });
  };
  return block("core/container", {}, dom.children.map(convert).filter(Boolean));
}
export function contentPath(c) {
  const d = new Date(c.publishAt || c.publish_at);
  return c.kind === "page"
    ? "/" + c.slug
    : "/" +
        d.getUTCFullYear() +
        "/" +
        String(d.getUTCMonth() + 1).padStart(2, "0") +
        "/" +
        c.slug;
}
function rich(node, ctx) {
  if (!node) return "";
  if (node.type === "text") {
    let out = esc(node.text);
    for (const m of node.marks || []) {
      const tag = {
        bold: "strong",
        italic: "em",
        underline: "u",
        strike: "s",
        code: "code",
      }[m.type];
      if (tag) out = "<" + tag + ">" + out + "</" + tag + ">";
      else if (m.type === "link")
        out = '<a href="' + esc(m.attrs?.href) + '">' + out + "</a>";
    }
    return out;
  }
  if (node.type === "media")
    return mediaHtml(
      ctx.media.find((m) => m.id === node.attrs?.mediaId),
      ctx,
    );
  const inner = (node.content || []).map((n) => rich(n, ctx)).join("");
  const tag = {
    paragraph: "p",
    bulletList: "ul",
    orderedList: "ol",
    listItem: "li",
    blockquote: "blockquote",
    codeBlock: "pre",
    heading: "h" + num(node.attrs?.level || 2, 1, 6),
  }[node.type];
  return node.type === "hardBreak"
    ? "<br>"
    : node.type === "horizontalRule"
      ? "<hr>"
      : tag
        ? "<" + tag + ">" + inner + "</" + tag + ">"
        : inner;
}
function mediaHtml(m, ctx) {
  if (!m) return "";
  const url =
    m.url +
    (ctx.previewToken
      ? "?themePreview=" + encodeURIComponent(ctx.previewToken)
      : "");
  return (
    "<figure>" +
    (m.type === "image"
      ? '<img src="' +
        esc(url) +
        '" alt="' +
        esc(m.altText) +
        '" loading="lazy">'
      : "<" +
        m.type +
        ' src="' +
        esc(url) +
        '" controls preload="metadata"></' +
        m.type +
        ">") +
    (m.caption ? "<figcaption>" + esc(m.caption) + "</figcaption>" : "") +
    "</figure>"
  );
}
function dynamic(type, s, ctx) {
  if (type === ADS_BLOCK) {
    const preview = !!(
      ctx.adsPreview ||
      ctx.renderingContentCanvas ||
      ctx.previewToken
    );
    const active = ctx.plugins?.some((p) => p.id === GOOGLE_ADS_ID);
    if (!active && !preview) return "";
    const unit = resolveAdUnit(ctx.adSettings, s);
    if (!unit && !preview) return "";
    if (preview || !unit?.liveAds) {
      const message = !active
        ? "Google Ads plugin is inactive"
        : !unit
          ? "Configure the publisher and ad slot in Google Ads"
          : `Ad preview · ${unit.format} · slot ${unit.slotId}`;
      return `<aside class="cl-ad-preview" aria-label="Advertisement preview" style="height:${unit?.sizing === "fixed" ? unit.height : 180}px"><strong>Advertisement</strong><p>${esc(message)}</p></aside>`;
    }
    return `<aside class="cl-ad-unit" aria-label="Advertisement"><span class="cl-ad-label">Advertisement</span><div class="cl-google-ad" data-google-ad-client="${esc(unit.publisherId)}" data-google-ad-slot="${esc(unit.slotId)}" data-google-ad-format="${esc(unit.format)}" data-google-ad-sizing="${esc(unit.sizing)}" data-google-ad-width="${unit.width}" data-google-ad-height="${unit.height}"></div></aside>`;
  }
  if (type === "core/slide-background") {
    const kind = ["image", "video", "model"].includes(s.backgroundType)
      ? s.backgroundType
      : "";
    if (!kind) return "";
    const media = ctx.media.find(
      (item) => item.id === s.backgroundMediaId && item.type === kind,
    );
    let url = media?.url || "";
    if (!url && typeof s.backgroundUrl === "string") {
      try {
        const external = new URL(s.backgroundUrl);
        if (
          external.protocol === "https:" &&
          !external.username &&
          !external.password
        )
          url = external.href;
      } catch {
        // Invalid external URLs leave the slide background empty.
      }
    }
    if (!url || /[<>\x00-\x1f]/.test(url)) return "";
    const x = ["left", "center", "right"].includes(s.backgroundPositionX)
      ? s.backgroundPositionX
      : "center";
    const y = ["top", "center", "bottom"].includes(s.backgroundPositionY)
      ? s.backgroundPositionY
      : "center";
    const size = ["cover", "contain", "auto"].includes(s.backgroundSize)
      ? s.backgroundSize
      : "cover";
    const repeat = ["repeat", "repeat-x", "repeat-y", "no-repeat"].includes(
      s.backgroundRepeat,
    )
      ? s.backgroundRepeat
      : "no-repeat";
    const id = /^[\w-]+$/.test(s.blockId || "") ? s.blockId : "";
    if (kind === "image") {
      if (!id) return "";
      ctx.contentCss.push(
        `[data-block-id="${id}"]>.cl-slide-background{background-image:url(${JSON.stringify(url)});background-position:${x} ${y};background-size:${size};background-repeat:${repeat};}`,
      );
      return '<div class="cl-slide-background" aria-hidden="true"></div>';
    }
    if (kind === "video") {
      if (id)
        ctx.contentCss.push(
          `[data-block-id="${id}"]>.cl-slide-background>video{object-fit:${size === "auto" ? "none" : size};object-position:${x} ${y};}`,
        );
      return `<div class="cl-slide-background" aria-hidden="true"><video src="${esc(url)}" autoplay muted playsinline ${s.backgroundLoop === false ? "" : "loop"} preload="metadata"></video></div>`;
    }
    if (id) {
      const dx = x === "left" ? -15 : x === "right" ? 15 : 0;
      const dy = y === "top" ? -15 : y === "bottom" ? 15 : 0;
      ctx.contentCss.push(
        `[data-block-id="${id}"]>.cl-slide-background>.gltf-viewer{transform:translate(${dx}%,${dy}%)${dx || dy ? " scale(1.3)" : ""};}`,
      );
    }
    return `<div class="cl-slide-background" aria-hidden="true"><div class="gltf-viewer" data-model-url="${esc(url)}" data-controls="false" data-auto-rotate="${s.backgroundAutoRotate === true}" data-rotate-speed="2" data-lazy-load="true" aria-label="Slide background model"></div></div>`;
  }
  if (type === "core/gltf") {
    const media = ctx.media.find(
      (m) => m.id === s.mediaId && m.type === "model",
    );
    const url =
      s.source === "url"
        ? /^https:\/\//.test(s.url || "")
          ? s.url
          : ""
        : media?.url;
    const poster = ctx.media.find(
      (m) => m.id === s.poster && m.type === "image",
    );
    return `<div class="gltf-viewer" tabindex="0" aria-label="${esc(s.ariaLabel || s.alt || "3D model")}" ${url ? `data-model-url="${esc(url)}"` : ""} data-controls="${s.controls !== false}" data-auto-rotate="${!!s.autoRotate}" data-rotate-speed="${num(s.autoRotateSpeed ?? 2, 0, 60)}" data-scroll-interactive="${s.scrollInteractive === true}" data-scroll-strength="${num(s.scrollStrength ?? 1, 0, 4)}" data-camera-zoom="${num(s.cameraZoom ?? 1, 0.5, 3)}" data-lazy-load="${s.lazyLoad !== false}" style="height:${num(s.height || 360, 100, 1600)}px">${poster ? `<img src="${esc(poster.url)}" alt="${esc(s.alt)}">` : `<p>${esc(s.alt || "Choose a model in the Inspector.")}</p>`}</div>`;
  }
  const c = ctx.content,
    settings = ctx.settings;
  if (type === "core/site-brand")
    return (
      '<a class="theme-site-brand" href="/">' +
      (settings.logo
        ? '<img src="' +
          esc(settings.logo) +
          '" alt="' +
          esc(settings.title) +
          '" height="52">'
        : "<h2>" + esc(settings.title) + "</h2>") +
      "</a>"
    );
  if (type === "core/post-content" || type === "core/content") {
    const contentHtml =
      Array.isArray(c?.details?.contentBlocks) && !ctx.renderingContentBlocks
        ? c.details.contentBlocks
            .map((block) =>
              compileBlock(block, {
                ...ctx.themeDocument,
                _gen: ctx.contentCss,
              }),
            )
            .join("")
            .replace(/{{block:([A-Za-z0-9+/=]+)}}/g, (_, payload) => {
              try {
                const b = JSON.parse(decodeURIComponent(escape(atob(payload))));
                return dynamic(b.type, b.settings, {
                  ...ctx,
                  renderingContentBlocks: true,
                });
              } catch {
                return "";
              }
            })
        : c?.details?.richText
          ? rich(c.details.richText, ctx)
          : esc(c?.body || "")
              .split(/\n\s*\n/)
              .map((p) => "<p>" + p + "</p>")
              .join("");
    if (ctx.renderingContentBlocks || ctx.renderingContentCanvas)
      return contentHtml;
    const mainSettings = c?.details?.contentMain || {};
    const mainId =
      "blk_content-main-" +
      String(c?.id || "entry")
        .replace(/[^\w-]/g, "")
        .slice(0, 60);
    if (mainSettings.minHeightEnabled)
      ctx.contentCss.push(minHeightCss(mainId, mainSettings));
    return `<main class="theme-block content-main" data-block-id="${mainId}" style="${styleSettings(mainSettings)}">${contentHtml}</main>`;
  }
  if (type === "core/post-meta")
    return c?.kind === "post"
      ? '<p class="theme-post-meta">' +
          (s.showDate !== false
            ? esc(
                new Date(c.publishAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  timeZone: "UTC",
                }),
              )
            : "") +
          (s.showAuthor
            ? esc(
                (s.showDate !== false ? s.separator || " · " : "") +
                  (c.author || ""),
              )
            : "") +
          (s.showCategories
            ? esc(
                (s.separator || " · ") +
                  (c.details?.categories || []).join(", "),
              )
            : "") +
          (s.showTags
            ? esc((s.separator || " · ") + (c.details?.tags || []).join(", "))
            : "") +
          (s.showReadingTime !== false &&
          ctx.plugins?.some((p) => p.id === "com.colossal.reading-time")
            ? esc(s.separator || " · ") +
              Math.max(1, Math.ceil((c.body || "").split(/\s+/).length / 200)) +
              " min read"
            : "") +
          "</p>"
      : "";
  if (type === "core/featured-image")
    return (
      mediaHtml(
        ctx.media.find(
          (m) => m.id === (c?.details?.featuredImageId || s.mediaId),
        ),
        ctx,
      ) || projectImage(c)
    );
  if (type === "core/image") {
    const m = ctx.media.find((m) => m.id === s.mediaId && m.type === "image");
    const src =
      s.source === "url"
        ? /^https:\/\//.test(s.url || "")
          ? s.url
          : ""
        : m?.url;
    if (!src) return "<p>Choose an image.</p>";
    const size = { small: 320, medium: 640, large: 960 }[s.size] || 0;
    const img = `<img src="${esc(src)}" alt="${esc(s.alt || m?.altText || "")}" loading="lazy" style="${size ? "max-width:" + size + "px;" : ""}border-radius:${num(s.radius, 0, 100)}px">`;
    const linked =
      /^https:\/\//.test(s.link || "") || /^\/(?!\/)/.test(s.link || "")
        ? `<a href="${esc(s.link)}">${img}</a>`
        : img;
    return `<figure>${linked}${s.caption ? `<figcaption>${esc(s.caption)}</figcaption>` : ""}</figure>`;
  }
  if (type === "core/media") {
    const m = ctx.media.find(
      (m) => m.id === s.mediaId && ["audio", "video"].includes(m.type),
    );
    const src =
      s.source === "url"
        ? /^https:\/\//.test(s.url || "")
          ? s.url
          : ""
        : m?.url;
    if (!src) return "<p>Choose a media file.</p>";
    const kind =
      m?.type || (/\.(mp3|wav|ogg)(\?|$)/i.test(src) ? "audio" : "video");
    const poster = ctx.media.find(
      (m) => m.id === s.poster && m.type === "image",
    );
    return `<${kind} src="${esc(src)}" ${s.controls !== false ? "controls" : ""} ${s.autoplay ? "autoplay muted" : ""} ${s.loop ? "loop" : ""} ${poster && kind === "video" ? `poster="${esc(poster.url)}"` : ""} preload="metadata"></${kind}>`;
  }
  if (type === "core/menu") {
    const page = ctx.allContent.find((c) => c.id === settings.postsPageId),
      index =
        settings.routingVersion === 2
          ? settings.homePageId
            ? page && "/" + page.slug
            : "/"
          : settings.postRouting === "page" && page
            ? "/" + page.slug
            : "/";
    return (
      '<nav class="theme-menu" aria-label="Site navigation" style="flex-direction:' +
      (s.orientation === "vertical" ? "column" : "row") +
      '">' +
      (index !== "/" ? '<a href="/">Home</a>' : "") +
      (index
        ? '<a href="' + index + '">' + esc(page?.title || "Journal") + "</a>"
        : "") +
      ctx.allContent
        .filter(
          (p) =>
            p.kind === "page" &&
            p.id !== settings.postsPageId &&
            p.id !== settings.homePageId &&
            p.id !== settings.notFoundPageId,
        )
        .map((p) => '<a href="/' + esc(p.slug) + '">' + esc(p.title) + "</a>")
        .join("") +
      '<a href="/search">Search</a></nav>'
    );
  }
  if (type === "core/search")
    return (
      '<form action="/search" method="get" role="search"><input type="search" name="q" value="' +
      esc(ctx.query || "") +
      '" placeholder="' +
      esc(s.placeholder || "Search stories…") +
      '" aria-label="Search content"><button type="submit">' +
      esc(s.buttonLabel || "Search") +
      "</button></form>"
    );
  if (type === "core/post-list") {
    const limit = num(s.limit || 6, 1, 50),
      page = num(ctx.page || 1, 1, 10000),
      unfiltered =
        ctx.kind === "search"
          ? ctx.allContent.filter((c) =>
              (c.title + " " + c.body)
                .toLowerCase()
                .includes((ctx.query || "").toLowerCase()),
            )
          : ctx.allContent.filter((c) => c.kind === "post");
    const list = unfiltered
      .filter(
        (c) => !s.portfolio || c.details?.panelData?.portfolioProject === true,
      )
      .filter((c) => !s.category || c.details?.categories?.includes(s.category))
      .sort((a, b) => {
        const av = s.orderBy === "title" ? a.title : a.publishAt;
        const bv = s.orderBy === "title" ? b.title : b.publishAt;
        return (
          (s.order === "ascending" ? 1 : -1) *
          String(av).localeCompare(String(bv))
        );
      });
    ctx.pages = Math.max(1, Math.ceil(list.length / limit));
    return (
      '<div class="theme-post-grid ' +
      (s.layout === "list" ? "theme-list" : "") +
      '" style="display:grid;grid-template-columns:repeat(' +
      num(s.layout === "list" ? 1 : s.columns || 3, 1, 6) +
      ', minmax(0, 1fr));gap:24px">' +
      (list
        .slice((page - 1) * limit, page * limit)
        .map(
          (p) =>
            '<article><a href="' +
            contentPath(p) +
            '">' +
            (s.showFeaturedImage === false
              ? ""
              : mediaHtml(
                  ctx.media.find((m) => m.id === p.details?.featuredImageId),
                  ctx,
                ) || projectImage(p)) +
            (s.portfolio && p.details?.panelData?.projectCategory
              ? '<span class="theme-project-category">' +
                esc(p.details.panelData.projectCategory) +
                "</span>"
              : "") +
            "<h2>" +
            esc(p.title) +
            "</h2></a>" +
            (s.showDate === false
              ? ""
              : "<small>" +
                esc(
                  new Date(p.publishAt).toLocaleDateString("en-US", {
                    timeZone: "UTC",
                  }),
                ) +
                "</small>") +
            (s.showExcerpt !== false ? "<p>" + esc(p.excerpt) + "</p>" : "") +
            "</article>",
        )
        .join("") || "<p>No matching stories yet.</p>") +
      "</div>"
    );
  }
  if (type === "core/pagination") {
    const page = num(ctx.page || 1, 1, 10000),
      pages = ctx.pages || 1;
    const href = (p) =>
      esc(
        ctx.path +
          "?" +
          new URLSearchParams({
            ...(ctx.kind === "search" ? { q: ctx.query || "" } : {}),
            page: String(p),
            ...(ctx.previewToken ? { themePreview: ctx.previewToken } : {}),
          }),
      );
    return pages > 1
      ? '<nav class="theme-pagination">' +
          (s.style === "load-more"
            ? page < pages
              ? '<a href="' + href(page + 1) + '">Load more</a>'
              : ""
            : (page > 1
                ? '<a href="' + href(page - 1) + '">Previous</a>'
                : "") +
              (s.style === "numbers" || !s.style
                ? "<span>Page " + page + " of " + pages + "</span>"
                : "") +
              (page < pages
                ? '<a href="' + href(page + 1) + '">Next</a>'
                : "")) +
          "</nav>"
      : "";
  }
  return "";
}
export const BASE_THEME_CSS =
  ".theme-root{min-height:100vh}.theme-root *{box-sizing:border-box}.theme-root img,.theme-root video{max-width:100%;height:auto}.theme-root audio{width:100%}.theme-root figure{margin:20px 0}.theme-root figcaption{font-size:13px;color:#74846a}.theme-menu{display:flex;gap:24px;flex-wrap:wrap}.theme-post-grid article{background:#ffffff;padding:24px;border:1px solid #e0e6da;border-radius:12px}.theme-post-grid a{text-decoration:none}.theme-post-grid h2{line-height:1.4}.theme-root pre{white-space:pre-wrap;background:#eaf0e1;padding:20px}.theme-root input,.theme-root button{font:inherit;padding:10px;border:1px solid #becdb4;border-radius:6px}.theme-pagination{display:flex;gap:24px;justify-content:center;padding:24px}@media(min-width:1025px){.theme-hide-desktop{display:none!important}}@media(min-width:641px) and (max-width:1024px){.theme-hide-tablet{display:none!important}.theme-post-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:640px){.theme-hide-mobile{display:none!important}.theme-columns,.theme-post-grid{grid-template-columns:1fr!important}}";
export const PICKER_THEME_CSS =
  "@keyframes cl-picker-fade{from{opacity:0}to{opacity:1}}@keyframes cl-picker-slide{from{transform:translateY(24px)}to{transform:translateY(0)}}@keyframes cl-picker-scale{from{transform:scale(.85)}to{transform:scale(1)}}@media(prefers-reduced-motion:reduce){.theme-root [data-block-id]{animation:none!important}}";
export const ADS_THEME_CSS =
  ".theme-root .cl-ad-preview{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:100px;border:1px dashed #8994a5;border-radius:8px;background:#8994a514;text-align:center;padding:16px}.theme-root .cl-ad-preview strong{font-size:13px}.theme-root .cl-ad-preview p{font-size:12px;margin:0}.theme-root .cl-ad-label{display:block;font:11px system-ui;text-align:center;color:#8994a5;padding:6px}.theme-root .cl-google-ad{width:100%;min-width:0}.theme-root .cl-google-ad ins{max-width:100%;margin:auto}";
export const SLIDER_THEME_CSS =
  ".theme-root .cl-swiper{position:relative;width:100%;overflow:hidden}.theme-root .cl-swiper .swiper-wrapper{display:flex;width:100%;height:100%;transition-property:transform}.theme-root .cl-swiper .swiper-slide{position:relative;flex-shrink:0;width:100%;height:100%;overflow:hidden}.theme-root .swiper-slide>.cl-slide-background{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}.theme-root .swiper-slide>.cl-slide-background>video,.theme-root .swiper-slide>.cl-slide-background>.gltf-viewer{display:block;width:100%;height:100%;max-width:none}.theme-root .swiper-slide>:not(.cl-slide-background){position:relative;z-index:1}.theme-root .cl-gltf-block{position:relative}.theme-root [data-block-id].cl-overlay-block{position:absolute!important;inset:0;z-index:40;pointer-events:none}.theme-root .cl-overlay-block>*{pointer-events:auto}.theme-root .cl-swiper .swiper-button-prev,.theme-root .cl-swiper .swiper-button-next{position:absolute;top:50%;z-index:50;transform:translateY(-50%);border:0;border-radius:50%;width:42px;height:42px;padding:0;background:#fff;color:#243e2f;box-shadow:0 2px 12px #0003;cursor:pointer}.theme-root .cl-swiper .swiper-button-prev{left:12px}.theme-root .cl-swiper .swiper-button-next{right:12px}.theme-root .cl-swiper .swiper-button-prev::after{content:'‹';font-size:32px;line-height:1}.theme-root .cl-swiper .swiper-button-next::after{content:'›';font-size:32px;line-height:1}.theme-root .cl-swiper .swiper-pagination{position:absolute;bottom:12px;left:0;right:0;z-index:50;display:flex;justify-content:center;gap:7px}.theme-root .cl-swiper .swiper-pagination-bullet{display:block;width:9px;height:9px;border:0;border-radius:50%;padding:0;background:#fff9;cursor:pointer}.theme-root .cl-swiper .swiper-pagination-bullet-active{background:#fff}";
export function renderTheme(d, ctx, override, options = {}) {
  const renderCtx = { ...ctx, themeDocument: d, contentCss: [] };
  const resolution = resolveTemplateForContent(
    d,
    ctx.kind,
    override ?? ctx.content?.templateId,
  );
  const root = resolution.template && d.templates[resolution.template.id];
  const part = options.part && d.parts[options.part];
  let html = part
    ? compileBlock(part, d)
    : root
      ? (d.compiled?.[resolution.template.id] ?? compileBlock(root, d, 0, true))
      : "<main><h1>{{content.title}}</h1>" +
        token(
          ctx.kind === "post-index" || ctx.kind === "search"
            ? "core/post-list"
            : "core/post-content",
          {},
        ) +
        "</main>";
  const tokens = {
    "content.title": ctx.content?.title || "",
    "content.excerpt": ctx.content?.excerpt || "",
    "site.title": ctx.settings.title,
    "site.tagline": ctx.settings.tagline,
  };
  tokens["content.title"] =
    ctx.content?.title ||
    (ctx.kind === "404"
      ? "Page not found"
      : ctx.kind === "search"
        ? "Search"
        : ctx.settings.tagline);
  html = html.replace(/{{block:([A-Za-z0-9+/=]+)}}/g, (_, payload) => {
    try {
      const b = JSON.parse(decodeURIComponent(escape(atob(payload))));
      return dynamic(b.type, b.settings, renderCtx);
    } catch {
      return "";
    }
  });
  html = html.replace(/{{([\w.]+)}}/g, (_, key) => esc(tokens[key] ?? ""));
  if (ctx.previewToken) {
    // Keep review navigation inside the same signed revision; never attach tokens to external destinations.
    html = html.replace(/href="(\/(?!\/)[^"]*)"/g, (full, raw) => {
      const path = raw.replaceAll("&amp;", "&");
      if (path.startsWith("/api/") || path.startsWith("/admin")) return full;
      const url = new URL(path, "https://preview.invalid");
      url.searchParams.set("themePreview", ctx.previewToken);
      return 'href="' + esc(url.pathname + url.search + url.hash) + '"';
    });
    html = html.replace(
      /<form\b[^>]*>/g,
      (form) =>
        form +
        '<input type="hidden" name="themePreview" value="' +
        esc(ctx.previewToken) +
        '">',
    );
  }
  // Resolve archive-owned assets at render time, so cloned/exported themes retain independent ownership.
  html = html.replace(/(src|poster)="([^"]+)"/g, (full, attr, url) => {
    const path = url
      .replace(/^\/api\/themes\/[^/]+\/assets\//, "")
      .split("?")[0];
    return d.assets?.[path]
      ? attr +
          '="/api/themes/' +
          esc(d.manifest.id) +
          "/assets/" +
          esc(path) +
          (ctx.previewToken
            ? "?themePreview=" + encodeURIComponent(ctx.previewToken)
            : "") +
          '"'
      : full;
  });
  const bodySettings = part ? {} : root?.settings || {};
  return {
    html: sanitizeTemplate(html, [], "render", true),
    body: {
      blockId: part ? "" : root?.id || "",
      className: String(bodySettings.classes || "")
        .split(/\s+/)
        .filter((name) => /^[a-zA-Z][\w-]*$/.test(name))
        .join(" "),
      style: styleSettings(bodySettings),
      themeId: d.manifest.id,
      templateId: resolution.template?.id || "core-fallback",
    },
    css:
      BASE_THEME_CSS +
      ADS_THEME_CSS +
      PICKER_THEME_CSS +
      SLIDER_THEME_CSS +
      (d.generatedCss || "") +
      renderCtx.contentCss.join("") +
      d.css,
    templateId: resolution.template?.id || "core-fallback",
    warning: resolution.warning,
  };
}

/** Editor canvas for one entry. It deliberately omits template and shared-part blocks. */
export function renderContentCanvas(d, ctx, rootId) {
  const contentCss = [];
  const renderCtx = {
    ...ctx,
    themeDocument: d,
    contentCss,
    renderingContentCanvas: true,
  };
  const id = /^blk_[\w-]{8,80}$/.test(rootId || "")
    ? rootId
    : "blk_content-main";
  const settings = ctx.content?.details?.contentMain || {};
  if (settings.minHeightEnabled) contentCss.push(minHeightCss(id, settings));
  const content = dynamic("core/post-content", {}, renderCtx);
  return {
    html: sanitizeTemplate(
      `<main class="theme-block content-main" data-block-id="${esc(id)}" style="${styleSettings(settings)}">${content}</main>`,
      [],
      "render",
      true,
    ),
    body: {
      blockId: "",
      className: "",
      style: "",
      themeId: d.manifest.id,
      templateId: "content-canvas",
    },
    css:
      BASE_THEME_CSS +
      ADS_THEME_CSS +
      ".content-main{min-height:120px}" +
      PICKER_THEME_CSS +
      SLIDER_THEME_CSS +
      (d.generatedCss || "") +
      contentCss.join("") +
      d.css,
  };
}
