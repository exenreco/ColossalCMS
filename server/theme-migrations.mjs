/** Non-destructive compatibility upgrade, applied when old snapshots are opened. */
import { defaultTheme, CMS_VERSION } from "./theme-engine.mjs";
import { upgradeColossal2027Document } from "./colossal-2027-ice-world.mjs";

export function migrateThemeDocument(input) {
  if (!input?.manifest || !input.templates || !input.parts) return input;
  const d = structuredClone(input);
  d.notices = [];
  // Rebase bundled prototype themes when the public release version is reset.
  if (
    d.manifest.author === "Colossal Core Team" &&
    /^>=2\.0\.[0-5]$/.test(d.manifest.requires?.colossal || "")
  ) {
    d.manifest.requires.colossal = ">=" + CMS_VERSION;
    if (d.manifest.isCore) d.manifest.version = CMS_VERSION;
  }
  if (!d.manifest.parts.content || !d.parts.content) {
    d.manifest.parts.content = "parts/content.html";
    d.parts.content = {
      id: "content_part_root",
      type: "core/container",
      settings: {},
      children: [
        { id: "migrated_content_block", type: "core/content", settings: {} },
      ],
    };
    d.notices.push("The missing Content part was added with a Content block.");
  } else if (d.parts.content?.children?.length === 0) {
    d.parts.content.children.push({
      id: "migrated_content_block",
      type: "core/content",
      settings: {},
    });
    d.notices.push("The empty Content part now displays page content.");
  }
  let count = 0;
  const visit = (node) => {
    if (node.type === "core/columns") {
      node.children = (node.children || []).map((child) => {
        if (child.type === "core/column") return child;
        count++;
        return {
          id: "column_" + child.id,
          type: "core/column",
          settings: { width: "1fr" },
          children: [child],
        };
      });
      delete node.settings.columns;
    }
    (node.children || []).forEach(visit);
  };
  [...Object.values(d.templates), ...Object.values(d.parts)].forEach(visit);
  if (count)
    d.notices.push(
      `${count} blocks were wrapped in Columns to match the current structure.`,
    );
  const roles = [
    ["home", "Home", "home"],
    ["page", "Page", "default"],
    ["post-index", "Posts", "post-archive"],
    ["post", "Single", "post-single"],
    ["search", "Search", "search"],
    ["404", "404", "not-found"],
  ];
  const legacyNames = {
    default: ["Default", "Page"],
    "post-archive": ["Post Archive", "Posts"],
    "post-single": ["Single Post", "Single"],
    "not-found": ["Not Found", "404"],
  };
  let core;
  let added = 0;
  for (const [scope, name, preferredId] of roles) {
    const legacy = d.manifest.templates.find(
      (t) =>
        t.id === preferredId &&
        t.name === legacyNames[t.id]?.[0] &&
        t.appliesTo?.includes(scope),
    );
    if (legacy) legacy.name = name;
    const candidates = d.manifest.templates.filter(
      (t) =>
        t.name === name &&
        t.appliesTo?.includes(scope) &&
        d.templates[t.id] &&
        (scope === "page" || t.appliesTo.length === 1 || t.id === preferredId),
    );
    if (candidates.length) {
      if (scope !== "page") {
        for (const t of d.manifest.templates)
          if (t !== candidates[0] && t.appliesTo?.includes(scope))
            t.isTypeDefault = false;
        candidates[0].isTypeDefault = true;
      }
      continue;
    }
    for (const t of d.manifest.templates)
      if (t.appliesTo?.includes(scope)) t.isTypeDefault = false;
    core ||= defaultTheme();
    let id = preferredId;
    for (
      let n = 2;
      d.templates[id] || d.manifest.templates.some((t) => t.id === id);
      n++
    )
      id = preferredId + "-" + n;
    const page = d.manifest.templates.find(
      (t) => t.appliesTo?.includes("page") && d.templates[t.id],
    );
    const legacyScope = d.manifest.templates.find(
      (t) => t.appliesTo?.includes(scope) && d.templates[t.id],
    );
    const source =
      legacyScope || ((scope === "home" || scope === "post") && page)
        ? d.templates[(legacyScope || page).id]
        : core.templates[preferredId];
    const root = structuredClone(source);
    root.children ||= [];
    const hasContent = (node) =>
      ["theme/part-content", "core/content", "core/post-content"].includes(
        node.type,
      ) || (node.children || []).some(hasContent);
    const hasType = (node, type) =>
      node.type === type ||
      (node.children || []).some((child) => hasType(child, type));
    const addBlock = (type, settings = {}) => {
      const main = root.children.find((node) => node.type === "core/container");
      const target = main?.children || root.children;
      const footer = target.findIndex(
        (node) => node.type === "theme/part-footer",
      );
      target.splice(footer < 0 ? target.length : footer, 0, {
        id: "migrated_" + scope.replaceAll("-", "_") + "_" + type.split("/")[1],
        type,
        settings,
      });
    };
    if (scope === "post-index" && !hasType(root, "core/post-list"))
      addBlock("core/post-list", { limit: 6, columns: 3, showExcerpt: true });
    if (scope === "search") {
      if (!hasType(root, "core/search")) addBlock("core/search");
      if (!hasType(root, "core/post-list"))
        addBlock("core/post-list", { limit: 6, columns: 2, showExcerpt: true });
    }
    if (["home", "page", "post"].includes(scope) && !hasContent(root)) {
      const main = root.children?.find(
        (node) => node.type === "core/container",
      );
      (main?.children || root.children).splice(
        main?.children ? main.children.length : root.children.length - 1,
        0,
        {
          id: "migrated_content_" + id,
          type: "theme/part-content",
          settings: {},
        },
      );
    }
    if (!d.manifest.parts.header)
      root.children = root.children.filter(
        (node) => node.type !== "theme/part-header",
      );
    if (!d.manifest.parts.footer)
      root.children = root.children.filter(
        (node) => node.type !== "theme/part-footer",
      );
    d.templates[id] = root;
    d.manifest.templates.push({
      id,
      name,
      file: "templates/" + id + ".html",
      appliesTo: [scope],
      ...(!d.manifest.templates.some((t) => t.isDefault)
        ? { isDefault: true }
        : { isTypeDefault: true }),
    });
    added++;
  }
  for (const t of d.manifest.templates.filter((t) =>
    t.appliesTo?.includes("404"),
  )) {
    const root = d.templates[t.id];
    if (!root) continue;
    root.children ||= [];
    const hasContent = (node) =>
      ["theme/part-content", "core/content", "core/post-content"].includes(
        node.type,
      ) || (node.children || []).some(hasContent);
    if (!hasContent(root)) {
      const main = root.children?.find(
        (node) => node.type === "core/container",
      );
      const target = main?.children || root.children;
      target.splice(main ? target.length : Math.max(0, target.length - 1), 0, {
        id: "migrated_404_content_" + t.id,
        type: "theme/part-content",
        settings: {},
      });
    }
  }
  if (added)
    d.notices.push(`${added} standard templates were added to this theme.`);
  return upgradeColossal2027Document(d);
}
