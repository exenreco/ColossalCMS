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
  upgradeGlossySingleColumns(document);
  upgradeGlossyCrossedLines(document);
  darkenGlossyOverlay(document);
  gradientGlossyMobileOverlay(document);
  constrainGlossyMobileHeader(document);
  floatGlossyMobileMenu(document);
  glassGlossyMobileDropdown(document);
  addGlossyHeaderSearch(document);
  tabletGlossyNavigation(document);
  alignGlossyMobileBrandLeft(document);
  styleGlossySearchTemplate(document);
  addGlossyFooterSocialLinks(document);
  addGlossyGithubSocialLink(document);
  refineGlossySearchHeadings(document);
  threeColumnGlossySearch(document);
  refineGlossySearchTitleLines(document);
  horizontalGlossySearchCards(document);
  compactGlossySearchThumbnails(document);
  stretchGlossySearchImages(document);
  edgeToEdgeGlossySearchCards(document);
  fillGlossySearchCardHeight(document);
  twoColumnGlossySearch(document);
  repairGlossyPostsArchive(document);
  refineGlossyProjectsHeading(document);
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

/** Native post layout with an editable shared sidebar. */
function upgradeGlossySingleColumns(document) {
  const marker = "/* Glossy single columns */";
  const root = document.templates?.["post-single"];
  if (!root || document.css?.includes(marker)) return;
  const nodes = [];
  const visit = (n) => {
    nodes.push(n);
    n.children?.forEach(visit);
  };
  [
    ...Object.values(document.templates || {}),
    ...Object.values(document.parts || {}),
  ].forEach(visit);
  const ids = new Set(nodes.map((n) => n.id));
  const make = (suffix, type, settings = {}, children) => {
    let id = "glossy-single-" + suffix;
    while (ids.has(id)) id += "-new";
    ids.add(id);
    return { id, type, settings, ...(children ? { children } : {}) };
  };
  const singleNodes = [];
  const walk = (n) => {
    singleNodes.push(n);
    n.children?.forEach(walk);
  };
  walk(root);
  const get = (type, suffix, settings = {}) =>
    structuredClone(
      singleNodes.find((n) => n.type === type) || make(suffix, type, settings),
    );
  const title = get("core/title", "title", { level: "h1" });
  const image = get("core/featured-image", "image");
  const content = get("core/post-content", "content");
  root.settings ||= {};
  root.settings.classes = String(root.settings.classes || "c27-body")
    .split(/\s+/)
    .filter((c) => c !== "c27-section")
    .join(" ");
  if (
    !root.children?.some((n) =>
      String(n.settings?.classes || "")
        .split(/\s+/)
        .includes("c27-single-layout"),
    )
  )
    root.children = [
      get("theme/part-header", "header"),
      make(
        "layout",
        "core/columns",
        {
          classes: "c27-single-layout",
          gap: 48,
          stackOnMobile: true,
          position: "relative",
          zIndex: 2,
        },
        [
          make(
            "main",
            "core/column",
            { width: "2fr", classes: "c27-single-main" },
            [title, image, content],
          ),
          make(
            "aside",
            "core/column",
            { width: "1fr", classes: "c27-single-sidebar" },
            [get("theme/part-sidebar", "sidebar")],
          ),
        ],
      ),
      get("theme/part-footer", "footer"),
    ];
  document.css =
    (document.css || "") +
    `
${marker}
.theme-root .c27-single-layout{width:100%;max-width:1280px;margin:64px auto;padding:0 48px;box-sizing:border-box;align-items:start}
.theme-root .c27-single-main,.theme-root .c27-single-sidebar{min-width:0}
.theme-root .c27-single-main h1{font-size:clamp(36px,4vw,64px);letter-spacing:-2px}
@media(max-width:600px){.theme-root .c27-single-layout{padding:0 24px;margin:40px auto}}
`;
  delete document.compiled;
}

/** Preserve custom line widths while upgrading the stock animated bands. */
function upgradeGlossyCrossedLines(document) {
  const marker = "/* Glossy crossed background lines */";
  if (document.css?.includes(marker)) return;
  const visit = (node) => {
    if (
      node.type === "core/gltf" &&
      node.settings?.scenePreset === "ice-world"
    ) {
      node.settings.sceneRainCrossEnabled ??= true;
      if (
        node.settings.sceneRainWidth == null ||
        node.settings.sceneRainWidth === 2
      )
        node.settings.sceneRainWidth = 3.5;
    }
    node.children?.forEach(visit);
  };
  Object.values(document.templates || {}).forEach(visit);
  document.css = (document.css || "") + "\n" + marker + "\n";
  delete document.compiled;
}

/** Darker landing scene overlay, applied once to existing and new Glossy themes. */
function darkenGlossyOverlay(document) {
  const marker = "/* Glossy darker background overlay */";
  if (document.css?.includes(marker)) return;
  const visit = (node) => {
    if (node.type === "core/gltf" && node.settings?.scenePreset === "ice-world")
      node.settings.sceneVeilOpacity = 0.92;
    node.children?.forEach(visit);
  };
  Object.values(document.templates || {}).forEach(visit);
  document.css = (document.css || "") + "\n" + marker + "\n";
  delete document.compiled;
}

function gradientGlossyMobileOverlay(document) {
  const marker = "/* Glossy mobile overlay gradient */";
  if (document.css?.includes(marker)) return;
  const visit = (node) => {
    if (node.type === "core/gltf" && node.settings?.scenePreset === "ice-world")
      node.settings.sceneVeilMobileGradient ??= true;
    node.children?.forEach(visit);
  };
  Object.values(document.templates || {}).forEach(visit);
  document.css = (document.css || "") + "\n" + marker + "\n";
  delete document.compiled;
}

/** Branding can shrink without displacing the mobile menu. */
function constrainGlossyMobileHeader(document) {
  const marker = "/* Glossy mobile header containment */";
  if (!document.css || document.css.includes(marker)) return;
  document.css += `
${marker}
@media(max-width:768px){
.theme-root .theme-part-header{width:100%;max-width:1280px;box-sizing:border-box;height:auto}
.theme-root .c27-header-inner{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;height:auto;min-height:62px}
.theme-root .c27-header-inner .c27-brand,.theme-root .c27-header-inner .c27-brand .theme-layout,.theme-root .c27-header-inner .c27-brand .theme-block{min-width:0;max-width:100%}
.theme-root .c27-header-inner .c27-brand{width:100%}
.theme-root .c27-header-inner .theme-menu-items{max-width:calc(100vw - 48px);max-height:70vh;overflow:auto}
}
`;
  delete document.compiled;
}

/** Mobile dropdown overlays the page instead of expanding the header. */
function floatGlossyMobileMenu(document) {
  const marker = "/* Glossy absolute mobile dropdown */";
  if (!document.css || document.css.includes(marker)) return;
  document.css += `
${marker}
@media(max-width:768px){
.theme-root .c27-header-inner .theme-menu{position:relative}
.theme-root .c27-header-inner .theme-menu .theme-menu-items{position:absolute;top:calc(100% + 12px);right:0;left:auto;z-index:200;min-width:220px;max-width:calc(100vw - 48px);max-height:70vh;overflow:auto}
}
`;
  delete document.compiled;
}

/** Use explicit background-color so theme CSS sanitizing preserves the glass. */
function glassGlossyMobileDropdown(document) {
  const marker = "/* Glossy mobile dropdown glass */";
  if (!document.css || document.css.includes(marker)) return;
  document.css += `
${marker}
@media(max-width:768px){
.theme-root .c27-header-inner .theme-menu .theme-menu-items{background-color:#17191bf2;background-image:linear-gradient(135deg,#ffffff08,transparent);backdrop-filter:blur(28px) saturate(130%);color:#f1f2f4;border:1px solid #ffffff30;border-radius:16px;padding:20px;box-shadow:0 16px 48px #0006}
}
`;
  delete document.compiled;
}

/** Register the same editable Search block inside Glossy's navigation. */
function addGlossyHeaderSearch(document) {
  const marker = "/* Glossy header search */";
  if (document.css?.includes(marker)) return;
  const visit = (n) => {
    if (n.type === "core/menu") {
      n.children ||= [];
      if (!n.children.some((c) => c.type === "core/search"))
        n.children.push({
          id: "glossy-nav-search-" + crypto.randomUUID(),
          type: "core/search",
          settings: {
            presentation: "expand",
            placeholder: "Search…",
            classes: "c27-nav-search",
          },
        });
      return;
    }
    n.children?.forEach(visit);
  };
  visit(document.parts?.header || {});
  document.css =
    (document.css || "") +
    `
${marker}
@media(max-width:768px){.theme-root .c27-header-inner .theme-menu-items .c27-nav-search{width:100%;max-width:100%}.theme-root .c27-header-inner .theme-menu-items .theme-search{width:100%;max-width:100%}.theme-root .c27-header-inner .theme-menu-items .theme-search input{width:100%;flex:1;opacity:1;padding:0 8px}}
`;
  delete document.compiled;
}

/** Collapse the portfolio navigation on phones and tablets. */
function tabletGlossyNavigation(document) {
  const marker = "/* Glossy tablet navigation */";
  if (document.css?.includes(marker)) return;
  const visit = (n) => {
    if (n.type === "core/menu") {
      n.settings.mobileMode = "collapsed";
      n.settings.mobileBreakpoint = "1024";
    }
    n.children?.forEach(visit);
  };
  visit(document.parts?.header || {});
  document.css =
    (document.css || "") +
    `
${marker}
@media(max-width:1024px){
.theme-root .theme-part-header{width:100%;height:auto;box-sizing:border-box}
.theme-root .c27-header-inner{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;height:auto;min-height:62px}
.theme-root .c27-header-inner .c27-brand,.theme-root .c27-header-inner .c27-brand .theme-layout,.theme-root .c27-header-inner .c27-brand .theme-block{min-width:0;max-width:100%}
.theme-root .c27-header-inner .c27-brand{width:100%}
.theme-root .c27-header-inner .theme-menu{position:relative;align-items:flex-end}
.theme-root .c27-header-inner .theme-menu .theme-menu-items{position:absolute;top:calc(100% + 12px);right:0;left:auto;z-index:200;min-width:220px;max-width:calc(100vw - 48px);max-height:70vh;overflow:auto;background-color:#17191bf2;background-image:linear-gradient(135deg,#ffffff08,transparent);backdrop-filter:blur(28px) saturate(130%);color:#f1f2f4;border:1px solid #ffffff30;border-radius:16px;padding:20px;box-shadow:0 16px 48px #0006}
.theme-root .c27-header-inner .theme-menu-toggle{border:1px solid #ffffff30;background-color:#ffffff0a;border-radius:10px;padding:10px}
.theme-root .c27-header-inner .theme-menu-items .c27-nav-search{width:100%;max-width:100%}
.theme-root .c27-header-inner .theme-menu-items .theme-search{width:100%;max-width:100%}
.theme-root .c27-header-inner .theme-menu-items .theme-search input{width:100%;opacity:1;padding:0 8px}
}
`;
  delete document.compiled;
}

/** Keep branding anchored to the same header gutter as its column resizes. */
function alignGlossyMobileBrandLeft(document) {
  const marker = "/* Glossy left aligned mobile branding */";
  if (!document.css || document.css.includes(marker)) return;
  document.css += `
${marker}
@media(max-width:1024px){
.theme-root .c27-header-inner .c27-brand{align-items:flex-start;text-align:left}
.theme-root .c27-header-inner .c27-brand>.theme-layout{justify-content:flex-start;align-self:flex-start}
.theme-root .c27-header-inner .c27-brand-copy,.theme-root .c27-header-inner .c27-brand-name-row,.theme-root .c27-header-inner .c27-brand-tagline-row{text-align:left;align-items:flex-start}
}
`;
  delete document.compiled;
}

/** The result-page search uses the solid dark reference style. */
function styleGlossySearchTemplate(document) {
  const marker = "/* Glossy dark search template field */";
  if (document.css?.includes(marker)) return;
  const visit = (n) => {
    if (!n) return;
    if (n.type === "core/search") {
      n.settings.searchStyle = "dark";
      n.settings.presentation = "inline";
    }
    n.children?.forEach(visit);
  };
  visit(document.templates?.search);
  document.css = (document.css || "") + "\n" + marker + "\n";
  delete document.compiled;
}

/** Editable icon buttons in the footer's Connect column. */
function addGlossyFooterSocialLinks(document) {
  const marker = "/* Glossy footer social icons */";
  if (document.css?.includes(marker)) return;
  const find = (n) => {
    if (
      String(n?.settings?.classes || "")
        .split(/\s+/)
        .includes("c27-footer-grid")
    )
      return n;
    for (const child of n?.children || []) {
      const match = find(child);
      if (match) return match;
    }
  };
  const column = find(document.parts?.footer)?.children?.[2];
  if (
    column &&
    !column.children?.some((child) =>
      String(child.settings?.classes || "")
        .split(/\s+/)
        .includes("c27-footer-social-links"),
    )
  ) {
    column.children ||= [];
    column.children.push({
      id: "glossy-social-row-" + crypto.randomUUID(),
      type: "core/row",
      settings: { classes: "c27-footer-social-links", gap: 12, wrap: false },
      children: ["facebook", "instagram", "linkedin"].map((name) => ({
        id: "glossy-social-" + name + "-" + crypto.randomUUID(),
        type: "core/button",
        settings: {
          text:
            name === "linkedin"
              ? "LinkedIn"
              : name.charAt(0).toUpperCase() + name.slice(1),
          href: "#",
          iconName: name,
          iconPosition: "before",
          iconSize: 20,
          classes: "c27-social-link",
        },
      })),
    });
  }
  document.css =
    (document.css || "") +
    `
${marker}
.theme-root .c27-footer-social-links{margin-top:20px}
.theme-root .c27-footer-social-links .theme-button{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;padding:0;border:1px solid #ffffff26;border-radius:50%;background-color:#ffffff08;color:#c5ced9}
.theme-root .c27-footer-social-links .theme-button span{display:none}
.theme-root .c27-footer-social-links .theme-button:hover{background-color:#ffffff18;color:#fff}
`;
  delete document.compiled;
}

function addGlossyGithubSocialLink(document) {
  const marker = "/* Glossy GitHub social icon */";
  if (document.css?.includes(marker)) return;
  const find = (n) => {
    if (
      String(n?.settings?.classes || "")
        .split(/\s+/)
        .includes("c27-footer-social-links")
    )
      return n;
    for (const child of n?.children || []) {
      const match = find(child);
      if (match) return match;
    }
  };
  const row = find(document.parts?.footer);
  if (row && !row.children?.some((n) => n.settings?.iconName === "github")) {
    row.children ||= [];
    row.children.push({
      id: "glossy-social-github-" + crypto.randomUUID(),
      type: "core/button",
      settings: {
        text: "GitHub",
        href: "#",
        iconName: "github",
        iconPosition: "before",
        iconSize: 20,
        classes: "c27-social-link",
      },
    });
  }
  document.css = (document.css || "") + "\n" + marker + "\n";
  delete document.compiled;
}

/** Readable result-page typography with an editable gap after the search field. */
function refineGlossySearchHeadings(document) {
  const marker = "/* Glossy search heading scale and spacing */";
  if (document.css?.includes(marker)) return;
  const visit = (n, inResults = false) => {
    if (!n) return;
    if (n.type === "core/heading" && n.settings.level === "h1") {
      n.settings.fontSize = 36;
      n.settings.lineHeight = 1.2;
      n.settings.classes = [
        ...new Set(
          String(n.settings.classes || "")
            .split(/\s+/)
            .filter(Boolean)
            .concat("c27-search-heading"),
        ),
      ].join(" ");
    }
    if (inResults && n.type === "core/title") {
      n.settings.fontSize = 24;
      n.settings.lineHeight = 1.3;
    }
    if (n.children) {
      for (let i = 0; i < n.children.length; i++) {
        const child = n.children[i];
        if (
          child.type === "core/search" &&
          n.children[i + 1]?.type === "core/post-list"
        )
          n.children.splice(i + 1, 0, {
            id: "glossy-search-spacer-" + crypto.randomUUID(),
            type: "core/spacer",
            settings: { height: 32, unit: "px" },
          });
      }
      n.children.forEach((c) =>
        visit(c, inResults || n.type === "core/post-list"),
      );
    }
  };
  visit(document.templates?.search);
  document.css =
    (document.css || "") +
    `
${marker}
.theme-root .c27-search-heading h1{font-size:inherit;line-height:inherit;letter-spacing:-1px}
`;
  delete document.compiled;
}

function threeColumnGlossySearch(document) {
  const marker = "/* Glossy three column search results */";
  if (document.css?.includes(marker)) return;
  const visit = (node) => {
    if (!node) return;
    if (node.type === "core/post-list") node.settings.columns = 3;
    node.children?.forEach(visit);
  };
  visit(document.templates?.search);
  document.css = (document.css || "") + "\n" + marker + "\n";
  delete document.compiled;
}

/** Pixel line heights match the shared typography control's unit model. */
function refineGlossySearchTitleLines(document) {
  const marker = "/* Glossy search title text and readable lines */";
  if (document.css?.includes(marker)) return;
  const visit = (node, inResults = false) => {
    if (!node) return;
    if (node.type === "core/heading" && node.settings.level === "h1") {
      node.settings.text = "Find it here:";
      delete node.settings.html;
      node.settings.lineHeight = 44;
    }
    if (inResults && node.type === "core/title") {
      node.settings.fontSize = 20;
      node.settings.lineHeight = 28;
      node.settings.classes = [
        ...new Set(
          String(node.settings.classes || "")
            .split(/\s+/)
            .filter(Boolean)
            .concat("c27-search-result-title"),
        ),
      ].join(" ");
    }
    node.children?.forEach((child) =>
      visit(child, inResults || node.type === "core/post-list"),
    );
  };
  visit(document.templates?.search);
  document.css =
    (document.css || "") +
    `
${marker}
.theme-root .c27-search-result-title h2{letter-spacing:-.3px;margin-bottom:12px}
`;
  delete document.compiled;
}

/** Native columns keep each result's image and text independently editable. */
function horizontalGlossySearchCards(document) {
  const marker = "/* Glossy horizontal search cards */";
  if (document.css?.includes(marker)) return;
  const make = (type, settings, children) => ({
    id: "glossy-search-card-" + crypto.randomUUID(),
    type,
    settings,
    ...(children ? { children } : {}),
  });
  const visit = (node) => {
    if (!node) return;
    if (
      node.type === "core/post-list" &&
      !node.children?.some((c) =>
        String(c.settings?.classes || "")
          .split(/\s+/)
          .includes("c27-search-result-row"),
      )
    ) {
      const image =
        node.children?.find((c) => c.type === "core/featured-image") ||
        make("core/featured-image", {});
      image.settings.aspectRatio = "1/1";
      image.settings.objectFit = "cover";
      const pagination = (node.children || []).filter(
        (c) => c.type === "core/pagination",
      );
      const copy = (node.children || []).filter(
        (c) => c !== image && c.type !== "core/pagination",
      );
      node.children = [
        make(
          "core/columns",
          { classes: "c27-search-result-row", gap: 16, stackOnMobile: false },
          [
            make(
              "core/column",
              { classes: "c27-search-result-image", width: "1fr" },
              [image],
            ),
            make(
              "core/column",
              { classes: "c27-search-result-copy", width: "2fr" },
              copy,
            ),
          ],
        ),
        ...pagination,
      ];
    }
    node.children?.forEach(visit);
  };
  visit(document.templates?.search);
  document.css =
    (document.css || "") +
    `
${marker}
.theme-root .c27-search-result-row>.theme-layout{align-items:start}
.theme-root .c27-search-result-image,.theme-root .c27-search-result-copy{min-width:0}
.theme-root .c27-search-result-image figure{margin:0}
.theme-root .c27-search-result-image img{border-radius:12px}
.theme-root .c27-search-result-copy p{margin-bottom:12px}
`;
  delete document.compiled;
}

function compactGlossySearchThumbnails(document) {
  const marker = "/* Glossy compact search thumbnail captions */";
  if (!document.css || document.css.includes(marker)) return;
  document.css +=
    "\n" +
    marker +
    "\n.theme-root .c27-search-result-image figcaption{display:none}\n";
  delete document.compiled;
}

function stretchGlossySearchImages(document) {
  const marker = "/* Glossy full height search thumbnails */";
  if (!document.css || document.css.includes(marker)) return;
  document.css += `
${marker}
.theme-root .c27-search-result-row>.theme-layout{align-items:stretch}
.theme-root .c27-search-result-image{position:relative;overflow:hidden;border-radius:12px;min-height:100px}
.theme-root .c27-search-result-image>[data-block-id]{position:absolute;top:0;right:0;bottom:0;left:0;height:100%}
.theme-root .c27-search-result-image figure,.theme-root .c27-search-result-image a{display:block;width:100%;height:100%;margin:0;overflow:hidden}
.theme-root .c27-search-result-image img{width:100%;height:100%;object-fit:cover;border-radius:0}
`;
  delete document.compiled;
}

/** The thumbnail reaches the card edges; only the text column has padding. */
function edgeToEdgeGlossySearchCards(document) {
  const marker = "/* Glossy edge to edge compact search cards */";
  if (document.css?.includes(marker)) return;
  const visit = (node, inResults = false) => {
    if (!node) return;
    if (node.type === "core/post-list")
      node.settings.classes = [
        ...new Set(
          String(node.settings.classes || "")
            .split(/\s+/)
            .filter(Boolean)
            .concat("c27-search-results"),
        ),
      ].join(" ");
    if (inResults) {
      if (node.type === "core/title") {
        node.settings.fontSize = 18;
        node.settings.lineHeight = 24;
      }
      if (node.type === "core/excerpt") {
        node.settings.fontSize = 14;
        node.settings.lineHeight = 21;
      }
      if (node.type === "core/post-meta") {
        node.settings.fontSize = 12;
        node.settings.lineHeight = 18;
      }
      if (
        String(node.settings.classes || "")
          .split(/\s+/)
          .includes("c27-search-result-row")
      )
        node.settings.gap = 0;
    }
    node.children?.forEach((child) =>
      visit(child, inResults || node.type === "core/post-list"),
    );
  };
  visit(document.templates?.search);
  document.css =
    (document.css || "") +
    `
${marker}
.theme-root .c27-search-results .theme-post-grid article{padding:0;overflow:hidden}
.theme-root .c27-search-result-row>.theme-layout{gap:0}
.theme-root .c27-search-result-image{border-radius:0}
.theme-root .c27-search-result-copy{padding:18px}
`;
  delete document.compiled;
}

function fillGlossySearchCardHeight(document) {
  const marker = "/* Glossy stretch complete search card rows */";
  if (!document.css || document.css.includes(marker)) return;
  document.css +=
    "\n" +
    marker +
    "\n.theme-root .c27-search-result-row,.theme-root .c27-search-result-row>.theme-layout{height:100%}\n";
  delete document.compiled;
}

function twoColumnGlossySearch(document) {
  const marker = "/* Glossy two column horizontal search results */";
  if (document.css?.includes(marker)) return;
  const visit = (node) => {
    if (!node) return;
    if (node.type === "core/post-list") node.settings.columns = 2;
    node.children?.forEach(visit);
  };
  visit(document.templates?.search);
  document.css = (document.css || "") + "\n" + marker + "\n";
  delete document.compiled;
}

/** Repair the import's content-only archive and refresh the original stock archive. */
function repairGlossyPostsArchive(document) {
  const marker = "/* Glossy restored posts archive */";
  const root = document.templates?.["post-archive"];
  if (!root || document.css?.includes(marker)) return;
  const find = (node, type) => {
    if (node?.type === type) return node;
    for (const child of node?.children || []) {
      const match = find(child, type);
      if (match) return match;
    }
  };
  const missingChrome =
    !find(root, "theme/part-header") &&
    !find(root, "theme/part-footer") &&
    root.children?.every((n) =>
      ["core/title", "core/excerpt", "core/post-content"].includes(n.type),
    );
  const stockHeading = find(root, "core/heading");
  const stock = stockHeading?.settings?.text === "{{site.tagline}}";
  if (missingChrome || stock) {
    const make = (type, settings = {}, children) => ({
      id: "glossy-posts-" + crypto.randomUUID(),
      type,
      settings,
      ...(children ? { children } : {}),
    });
    const clone = (node) => {
      const copy = structuredClone(node);
      const visit = (n) => {
        n.id = "glossy-posts-" + crypto.randomUUID();
        n.children?.forEach(visit);
      };
      visit(copy);
      return copy;
    };
    const listSource =
      find(document.templates.search, "core/post-list") ||
      find(root, "core/post-list");
    if (!listSource) return;
    const list = clone(listSource);
    list.settings.columns = 2;
    const header = find(root, "theme/part-header") || make("theme/part-header");
    const footer = find(root, "theme/part-footer") || make("theme/part-footer");
    root.settings ||= {};
    root.settings.classes = [
      ...new Set(
        String(root.settings.classes || "")
          .split(/\s+/)
          .filter((c) => c && c !== "c27-section")
          .concat("c27-body"),
      ),
    ].join(" ");
    root.children = [
      header,
      make(
        "core/container",
        {
          classes: "c27-article c27-posts-archive",
          maxWidth: 1280,
          padding: { top: 64, right: 48, bottom: 64, left: 48 },
        },
        [
          make("core/title", { level: "h1", fontSize: 36, lineHeight: 44 }),
          make("core/spacer", { height: 24, unit: "px" }),
          list,
        ],
      ),
      footer,
    ];
  }
  document.css = (document.css || "") + "\n" + marker + "\n";
  delete document.compiled;
}

/** A readable Projects title with an independently editable Divider below it. */
function refineGlossyProjectsHeading(document) {
  const marker = "/* Glossy Projects heading and divider */";
  const root = document.templates?.projects;
  if (!root || document.css?.includes(marker)) return;
  let parent = root;
  let index =
    root.children?.findIndex(
      (n) =>
        n.type === "core/title" ||
        (n.type === "core/heading" && n.settings.level === "h1"),
    ) ?? -1;
  if (index < 0) {
    index = root.children?.[0]?.type === "theme/part-header" ? 1 : 0;
    root.children ||= [];
    root.children.splice(index, 0, {
      id: "glossy-projects-title-" + crypto.randomUUID(),
      type: "core/title",
      settings: { level: "h1" },
    });
  }
  const heading = parent.children[index];
  heading.settings.fontSize = 36;
  heading.settings.lineHeight = 44;
  heading.settings.classes = [
    ...new Set(
      String(heading.settings.classes || "")
        .split(/\s+/)
        .filter(Boolean)
        .concat("c27-projects-heading"),
    ),
  ].join(" ");
  if (parent.children[index + 1]?.type !== "core/divider")
    parent.children.splice(index + 1, 0, {
      id: "glossy-projects-divider-" + crypto.randomUUID(),
      type: "core/divider",
      settings: {
        lineColor: "#ffffff26",
        thickness: 1,
        lineStyle: "solid",
        dividerWidth: 100,
        align: "center",
        spacing: 16,
        classes: "c27-projects-divider",
      },
    });
  document.css =
    (document.css || "") +
    `
${marker}
.theme-root .c27-projects-heading h1{font-size:inherit;line-height:inherit;letter-spacing:-1px}
.theme-root .c27-projects-heading,.theme-root .c27-projects-divider{max-width:1280px;margin:0 auto;padding-left:48px;padding-right:48px;box-sizing:border-box}
@media(max-width:600px){.theme-root .c27-projects-heading,.theme-root .c27-projects-divider{padding-left:24px;padding-right:24px}}
`;
  delete document.compiled;
}
