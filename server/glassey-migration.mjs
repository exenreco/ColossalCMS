// Keep the installed identity and asset URLs stable for existing sites and exports.
import { upgradeGlasseyNativeBlocks } from "./glassey-native-blocks.mjs";
export const GLASSEY_THEME_ID = "com.colossal.theme.colossal-2027";

export function isGlasseyTheme(id) {
  return (
    typeof id === "string" &&
    (id === GLASSEY_THEME_ID || id.startsWith(GLASSEY_THEME_ID + "."))
  );
}

/** Update an owned document; retain custom footer copy and all block identities. */
export function migrateGlasseyDocument(document) {
  if (!isGlasseyTheme(document?.manifest?.id)) return document;
  document.manifest = migrateGlasseyManifest(document.manifest);
  // Glossy's base colors and typography are scoped to its real HTML body.
  // Preserve authored template classes when a replacement root lost this class.
  for (const root of Object.values(document.templates || {})) {
    if (!root?.settings) continue;
    const classes = String(root.settings.classes || "")
      .split(/\s+/)
      .filter(Boolean);
    if (!classes.includes("c27-body")) {
      root.settings.classes = ["c27-body", ...classes].join(" ");
      delete document.compiled;
    }
  }
  const visit = (node) => {
    if (
      ["core/rich-text", "core/paragraph"].includes(node?.type) &&
      typeof node.settings?.html === "string"
    )
      node.settings.html = node.settings.html.replace(
        '<p class="c27-small-label">COLOSSAL 2027 / PORTFOLIO</p>',
        '<p class="c27-small-label">GLOSSY / PORTFOLIO</p>',
      );
    if (
      node?.type === "core/paragraph" &&
      ["COLOSSAL 2027 / PORTFOLIO", "GLASSEY / PORTFOLIO"].includes(
        node.settings?.html,
      )
    )
      node.settings.html = "GLOSSY / PORTFOLIO";
    node?.children?.forEach(visit);
  };
  visit(document.parts?.footer);
  upgradeGlasseyNativeBlocks(document);
  upgradeGlossyHeader(document);
  upgradeGlossyBrandLayout(document);
  upgradeGlossyBrandSize(document);
  alignGlossyHeroWidth(document);
  registerGlossyHomePatterns(document);
  alignGlossyHomeContent(document);
  alignGlossyPageWidths(document);
  expandGlossyFooter(document);
  expandGlossyCopyright(document);
  glassGlossyFooter(document);
  for (const node of document.templates?.home?.children || []) {
    if (
      String(node.settings?.classes || "")
        .split(/\s+/)
        .includes("c27-home-content") &&
      node.settings.position === undefined &&
      node.settings.zIndex === undefined
    ) {
      node.settings.position = "relative";
      node.settings.zIndex = 2;
      delete document.compiled;
    }
  }
  return document;
}

export function migrateGlasseyManifest(manifest) {
  if (!isGlasseyTheme(manifest?.id)) return manifest;
  return {
    ...manifest,
    name: ["Colossal 2027", "Glassey", "Glassy"].includes(manifest.name)
      ? "Glossy"
      : manifest.name,
    isCore: false,
  };
}

/** Keep installed block IDs and authored navigation while switching the stock header. */
function upgradeGlossyHeader(document) {
  if (
    (document.css || "").includes("/* Glossy identity and mobile navigation */")
  )
    return;
  let changed = false;
  const visit = (node) => {
    if (!node) return;
    if (
      ["core/rich-text", "core/html"].includes(node.type) &&
      /class="c27-brand"/.test(node.settings?.html || "")
    ) {
      const { html, ...settings } = node.settings;
      node.type = "core/site-brand";
      node.settings = {
        display: "logo-and-name",
        level: "span",
        logoHeight: 38,
        gap: 14,
        linkHome: true,
        ...settings,
        classes: [settings.classes, "c27-brand"].filter(Boolean).join(" "),
      };
      delete node.children;
      changed = true;
    }
    if (node.type === "core/menu") {
      const mobile = {
        mobileMode: "collapsed",
        mobileIcon: "bars",
        mobileLabel: "",
        mobileBreakpoint: "768",
      };
      if (
        Object.entries(mobile).some(
          ([key, value]) => node.settings[key] !== value,
        )
      ) {
        Object.assign(node.settings, mobile);
        changed = true;
      }
    }
    node.children?.forEach(visit);
  };
  visit(document.parts?.header);
  const footer = (node) => {
    if (!node) return;
    if (
      node.type === "core/paragraph" &&
      node.settings?.html === "GLASSEY / PORTFOLIO"
    ) {
      node.settings.html = "GLOSSY / PORTFOLIO";
      changed = true;
    }
    node.children?.forEach(footer);
  };
  footer(document.parts?.footer);
  if (
    !(document.css || "").includes(
      "/* Glossy identity and mobile navigation */",
    )
  ) {
    document.css = (document.css || "") + GLOSSY_HEADER_CSS;
    changed = true;
  }
  if (changed) delete document.compiled;
}

const GLOSSY_HEADER_CSS = `
/* Glossy identity and mobile navigation */
.theme-root .c27-brand .theme-site-brand{color:inherit;text-decoration:none}
.theme-root .c27-brand .theme-site-name{font-size:12px;font-weight:700;letter-spacing:1.4px;line-height:1.7}
.theme-root .c27-brand .theme-site-logo{max-width:140px}
@media(max-width:768px){
.theme-root .c27-header-inner .theme-menu{position:relative;align-items:flex-end}
.theme-root .c27-header-inner .theme-menu-toggle{border:1px solid #ffffff30;background:#ffffff0a;border-radius:10px;padding:10px}
.theme-root .c27-header-inner .theme-menu-items{position:absolute;right:0;top:calc(100% + 18px);min-width:220px;padding:20px;gap:18px;background:#17191bf2;backdrop-filter:blur(28px);border:1px solid #ffffff30;border-radius:16px;box-shadow:0 16px 48px #0006}
.theme-root .c27-header-inner .theme-menu-items>:nth-child(2),.theme-root .c27-header-inner .theme-menu-items>:nth-child(3),.theme-root .c27-header-inner nav a:nth-child(2),.theme-root .c27-header-inner nav a:nth-child(3){display:block}
.theme-root .c27-header-inner .theme-menu-items>.theme-button.c27-nav-contact{display:inline-flex}
}
`;

/** Split stock branding into editable layout blocks once; preserve subsequent edits. */
function upgradeGlossyBrandLayout(document) {
  const marker = "/* Glossy two-column branding */";
  if ((document.css || "").includes(marker)) return;
  const block = (type, settings, children) => ({
    id: "blk_" + crypto.randomUUID(),
    type,
    settings,
    ...(children ? { children } : {}),
  });
  const visit = (node) => {
    if (!node) return;
    if (
      node.type === "core/site-brand" &&
      (node.settings?.classes || "").split(/\s+/).includes("c27-brand")
    ) {
      const { display, level, logoHeight, gap, linkHome, ...appearance } =
        node.settings;
      const name = block("core/site-brand", {
        ...appearance,
        classes: "c27-brand-name",
        display: "name",
        level: level || "span",
        linkHome: linkHome !== false,
      });
      node.type = "core/columns";
      node.settings = {
        ...appearance,
        display: "flex",
        gap: gap ?? 14,
        verticalAlign: "center",
        wrap: false,
        stackOnMobile: false,
      };
      node.children = [
        block(
          "core/column",
          { classes: "c27-brand-logo-column", width: "1fr" },
          [
            block("core/site-brand", {
              classes: "c27-brand-logo",
              display: "logo",
              logoHeight: logoHeight ?? 38,
              linkHome: linkHome !== false,
            }),
          ],
        ),
        block("core/column", { classes: "c27-brand-copy", width: "1fr" }, [
          block(
            "core/row",
            { classes: "c27-brand-name-row", gap: 0, wrap: false },
            [name],
          ),
          block(
            "core/row",
            { classes: "c27-brand-tagline-row", gap: 0, wrap: false },
            [
              block("core/tagline", {
                classes: "c27-brand-tagline",
                align: "left",
              }),
            ],
          ),
        ]),
      ];
      return;
    }
    node.children?.forEach(visit);
  };
  visit(document.parts?.header);
  document.css =
    (document.css || "") +
    `
${marker}
.theme-root .c27-header-inner .c27-brand{display:block;min-width:0}
.theme-root .c27-brand-logo-column{flex:0 0 auto}
.theme-root .c27-brand-copy{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}
.theme-root .c27-brand .theme-site-name{margin:0}
.theme-root .c27-brand .theme-site-tagline{margin:0;font-size:8px;font-weight:400;color:#9297a0;letter-spacing:1.3px;line-height:1.5}
@media(max-width:600px){.theme-root .c27-brand .theme-site-name{font-size:10px;letter-spacing:.6px}.theme-root .c27-brand .theme-site-tagline{font-size:7px;letter-spacing:.6px}}
`;
  delete document.compiled;
}

function upgradeGlossyBrandSize(document) {
  const marker = "/* Glossy balanced header branding */";
  if ((document.css || "").includes(marker)) return;
  const visit = (node) => {
    if (!node) return;
    if (
      node.type === "core/site-brand" &&
      (node.settings?.classes || "").split(/\s+/).includes("c27-brand-logo") &&
      (node.settings.logoHeight == null ||
        [38, 56].includes(node.settings.logoHeight))
    )
      node.settings.logoHeight = 46;
    node.children?.forEach(visit);
  };
  visit(document.parts?.header);
  document.css =
    (document.css || "") +
    `
${marker}
.theme-root .c27-brand .theme-site-tagline{font-size:12px;letter-spacing:.8px}
@media(max-width:600px){.theme-root .c27-brand .theme-site-tagline{font-size:10px;letter-spacing:.4px}}
`;
  delete document.compiled;
}

/** Keep the full-width scene while aligning its copy with content sections. */
function alignGlossyHeroWidth(document) {
  if (!document.css || document.css.includes("/* Glossy aligned hero copy */"))
    return;
  const widths = [
    ...document.css.matchAll(
      /\.theme-root \.c27-section\s*\{[^}]*?max-width:\s*(\d+)px/g,
    ),
  ];
  const width = Number(widths.at(-1)?.[1] || 1184);
  document.css += `
/* Glossy aligned hero copy */
.theme-root .c27-hero.c27-hero-world{padding-left:0;padding-right:0}
.theme-root .c27-hero-world .c27-hero-copy{width:100%;max-width:${width}px;margin:0 auto;padding-left:24px;padding-right:24px;box-sizing:border-box}
`;
  delete document.compiled;
}

/** Move the authored Home sections into reusable, theme-owned patterns once. */
function registerGlossyHomePatterns(document) {
  const home = document.templates?.home;
  if (
    !home?.children ||
    document.manifest.patterns?.some((p) => p.id === "glossy-home-work")
  )
    return;
  const boundary = home.children.findIndex((n) =>
    String(n.settings?.classes || "")
      .split(/\s+/)
      .includes("c27-intro-line"),
  );
  if (boundary < 0) return;
  const definitions = [
    ["c27-work", "glossy-home-work", "Glossy · Selected work"],
    ["c27-about", "glossy-home-about", "Glossy · About"],
    [
      "c27-resume",
      "glossy-home-resume",
      "Glossy · Background and capabilities",
    ],
    ["c27-contact", "glossy-home-contact", "Glossy · Contact"],
  ];
  const sections = home.children.slice(boundary + 1).filter((n) =>
    definitions.some(([cls]) =>
      String(n.settings?.classes || "")
        .split(/\s+/)
        .includes(cls),
    ),
  );
  if (!sections.length) return;
  const patterns = document.manifest.patterns || [];
  for (const section of sections) {
    const [, id, name] = definitions.find(([cls]) =>
      String(section.settings?.classes || "")
        .split(/\s+/)
        .includes(cls),
    );
    if (!patterns.some((p) => p.id === id))
      patterns.push({
        id,
        name,
        category: "Theme",
        description: "Reusable section from the Glossy Home design.",
        blocks: [structuredClone(section)],
      });
  }
  document.manifest.patterns = patterns;
  const usedIds = new Set();
  const visit = (n) => {
    usedIds.add(n.id);
    n.children?.forEach(visit);
  };
  [
    ...Object.values(document.templates),
    ...Object.values(document.parts || {}),
  ].forEach(visit);
  let contentId = "glossy-home-page-content";
  while (usedIds.has(contentId)) contentId += "-new";
  home.children = home.children.filter((n) => !sections.includes(n));
  home.children.splice(boundary + 1, 0, {
    id: contentId,
    type: "core/post-content",
    settings: {
      classes: "c27-section c27-home-content",
      position: "relative",
      zIndex: 2,
    },
  });
  delete document.compiled;
}

/** Match the content wrapper to the hero, including narrower editor viewports. */
function alignGlossyHomeContent(document) {
  if (
    !document.css ||
    document.css.includes("/* Glossy aligned home content */")
  )
    return;
  const width = Number(
    document.css.match(
      /\.c27-hero-world \.c27-hero-copy\{width:100%;max-width:(\d+)px/,
    )?.[1] || 1184,
  );
  document.css += `
/* Glossy aligned home content */
.theme-root .c27-section.c27-home-content{width:100%;max-width:${width}px;margin:0 auto;padding-left:24px;padding-right:24px;box-sizing:border-box}
`;
  delete document.compiled;
}

/** Give hero copy, page content and footer a single responsive content grid. */
function alignGlossyPageWidths(document) {
  const marker = "/* Glossy shared page width */";
  if (!document.css || document.css.includes(marker)) return;
  document.css += `
${marker}
.theme-root .c27-hero-world .c27-hero-copy,.theme-root .c27-section.c27-home-content,.theme-root .theme-part-footer{width:100%;max-width:1280px;margin:0 auto;padding-left:48px;padding-right:48px;box-sizing:border-box}
@media(max-width:600px){.theme-root .c27-hero-world .c27-hero-copy,.theme-root .c27-section.c27-home-content,.theme-root .theme-part-footer{padding-left:24px;padding-right:24px}}
`;
  delete document.compiled;
}

/** Full-width footer surface with a centered, constrained column grid. */
function expandGlossyFooter(document) {
  const marker = "/* Glossy full width footer */";
  if (!document.css || document.css.includes(marker)) return;
  document.css += `
${marker}
.theme-root .theme-part-footer{width:100%;max-width:none;margin:0;padding-left:0;padding-right:0}
.theme-root .c27-footer-grid,.theme-root .c27-footer-bottom{width:100%;max-width:1280px;margin-left:auto;margin-right:auto;padding-left:48px;padding-right:48px;box-sizing:border-box}
@media(max-width:600px){.theme-root .c27-footer-grid,.theme-root .c27-footer-bottom{padding-left:24px;padding-right:24px}}
`;
  delete document.compiled;
}

/** Stretch the copyright divider while keeping its text on the column grid. */
function expandGlossyCopyright(document) {
  const marker = "/* Glossy full width copyright */";
  if (!document.css || document.css.includes(marker)) return;
  document.css += `
${marker}
.theme-root .c27-footer-bottom{width:100%;max-width:none;margin-left:0;margin-right:0;padding-left:0;padding-right:0}
.theme-root .c27-footer-bottom p{width:100%;max-width:1280px;margin:0 auto;padding-left:48px;padding-right:48px;box-sizing:border-box}
@media(max-width:600px){.theme-root .c27-footer-bottom p{padding-left:24px;padding-right:24px}}
`;
  delete document.compiled;
}

/** One continuous glass surface behind the columns and copyright row. */
function glassGlossyFooter(document) {
  const marker = "/* Glossy full footer glass */";
  if (!document.css || document.css.includes(marker)) return;
  document.css += `
${marker}
.theme-root .theme-part-footer{background-color:#17191bc9;background-image:linear-gradient(135deg,#ffffff08,transparent);backdrop-filter:blur(20px) saturate(115%);border-top:1px solid #ffffff18}
.theme-root .theme-part-footer .c27-footer{background-color:transparent;background-image:none;border-top:0}
.theme-root .theme-part-footer .c27-footer-bottom{background-color:transparent;background-image:none}
`;
  delete document.compiled;
}
