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
