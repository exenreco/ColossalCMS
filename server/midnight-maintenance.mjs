import postcss from "postcss";
const marker = "/* Midnight geometry v1 */";
function upgradeMidnightGeometry(document) {
  if (
    document?.manifest?.id !== "com.colossal.maintenance.midnight" ||
    document.css?.includes(marker)
  )
    return false;
  const root = document.templates.home;
  document.blocks.push({
    type: "maintenance/geometry",
    label: "Moving geometry",
    category: "Background",
    icon: "fas fa-project-diagram",
    container: false,
    description:
      "Interactive circles and connections behind the maintenance message.",
    fields: [
      {
        key: "count",
        label: "Circles",
        type: "number",
        default: 72,
        min: 12,
        max: 120,
      },
      {
        key: "speed",
        label: "Movement speed",
        type: "number",
        default: 1,
        min: 0,
        max: 4,
      },
      {
        key: "distance",
        label: "Connection distance",
        type: "number",
        default: 180,
        min: 60,
        max: 320,
      },
    ],
    template:
      '<div class="maintenance-geometry" style="position:fixed;top:0px;right:0px;bottom:0px;left:0px;z-index:2;pointer-events:none" data-geometry-count="{{setting.count}}" data-geometry-speed="{{setting.speed}}" data-geometry-distance="{{setting.distance}}" aria-hidden="true"></div><div class="maintenance-midnight-veil" style="position:fixed;top:0px;right:0px;bottom:0px;left:0px;z-index:1;pointer-events:none" aria-hidden="true"></div>',
  });
  document.manifest.blocks.push({
    type: "maintenance/geometry",
    icon: "fas fa-project-diagram",
    file: "blocks/geometry.html",
  });
  root.children.unshift({
    id: "blk_" + crypto.randomUUID(),
    type: "maintenance/geometry",
    settings: { count: 72, speed: 1, distance: 180 },
  });
  root.settings.classes = [root.settings.classes, "maintenance-midnight"]
    .filter(Boolean)
    .join(" ");
  const visit = (node) => {
    if (node.type === "core/site-brand")
      Object.assign(node.settings, {
        display: "logo-and-name",
        logoHeight: 32,
        classes: "midnight-identity",
        position: "fixed",
        top: 40,
        left: 48,
        zIndex: 3,
        level: "span",
        linkHome: false,
      });
    if (
      node.type === "core/rich-text" &&
      /^<p(?: class="maintenance-note")?>[\s\S]*<\/p>$/.test(
        node.settings.html || "",
      )
    ) {
      const note = node.settings.html.includes('class="maintenance-note"');
      node.type = "core/paragraph";
      node.settings.html = node.settings.html
        .replace(/^<p[^>]*>/, "")
        .replace(/<\/p>$/, "");
      if (note) node.settings.classes = "maintenance-note";
    }
    node.children?.forEach(visit);
  };
  visit(root);
  document.manifest.loading = {
    background: "#030e30",
    color: "#edf4ff",
    accent: "#a7c8ff",
    animation: "pulse",
  };
  document.css += `
${marker}
.theme-root.maintenance-midnight{position:relative;isolation:isolate;min-height:100vh;min-height:100svh;width:100%;padding:24px;box-sizing:border-box;background-color:#081c45;color:#edf4ff;overflow:hidden}
.theme-root .maintenance-midnight-veil{background-color:rgba(3,14,48,.88)}
.theme-root .maintenance-geometry{position:fixed;inset:0;z-index:0;pointer-events:none;background-image:radial-gradient(circle at 24% 30%,#97bfff30 1px,transparent 2px);background-size:100px 100px}
.theme-root .maintenance-geometry canvas{display:block;width:100%;height:100%;opacity:.4}
.theme-root.maintenance-midnight .maintenance-card{position:relative;z-index:3;background-color:transparent;background-image:none;border:0;border-radius:0;box-shadow:none;text-align:center;max-width:900px!important;padding:56px 32px!important}
.theme-root.maintenance-midnight h1{font-size:clamp(42px,6.6vw,92px);font-weight:500;letter-spacing:-.055em;line-height:1.04;margin:28px 0;color:#f2f6ff;text-wrap:balance}
.theme-root.maintenance-midnight .maintenance-card>div>p{max-width:520px;margin:0 auto;font-size:16px;color:#adbbd3;line-height:1.9;text-wrap:balance}
.theme-root.maintenance-midnight .maintenance-eyebrow>.theme-layout{justify-content:center}
.theme-root.maintenance-midnight .maintenance-eyebrow{color:#a7c8ff;letter-spacing:.22em;font-size:10px;font-weight:500}
.theme-root.maintenance-midnight .maintenance-eyebrow p{margin:0}
.theme-root.maintenance-midnight .midnight-identity{position:fixed;top:40px;left:48px;z-index:3;max-width:calc(100vw - 96px);text-align:left;letter-spacing:.12em;font-size:12px}
.theme-root.maintenance-midnight .theme-preview-banner{position:relative;z-index:4;background-color:#14264b;color:#b7c9e8}.theme-root.maintenance-midnight .theme-preview-banner a{color:#edf4ff}
.theme-root.maintenance-midnight .maintenance-note{margin-top:40px;letter-spacing:.1em;font-size:11px;opacity:.75}
@media(max-width:600px){.theme-root.maintenance-midnight{padding:16px}.theme-root.maintenance-midnight .midnight-identity{left:24px!important;top:28px!important;max-width:calc(100vw - 48px)}.theme-root.maintenance-midnight .maintenance-card{padding:80px 8px!important}.theme-root.maintenance-midnight h1{font-size:clamp(40px,12vw,64px)}}
`;
  delete document.compiled;
  return true;
}

const headerMarker = "/* Midnight header v2 */";
const positionMarker = "/* Midnight header positioning v3 */";
const headerPosition = {
  position: "fixed",
  offsets: { top: 32, left: 40, right: 40, bottom: "auto" },
  zIndex: 4,
};
const mobileHeaderPosition =
  "@media(max-width:600px){.theme-root.maintenance-midnight .midnight-header{top:20px!important;left:16px!important;right:16px!important}}";
function upgradeMidnightHeader(document) {
  const updated = upgradeMidnightGeometry(document);
  if (document?.manifest?.id !== "com.colossal.maintenance.midnight")
    return updated;
  if (document.css?.includes(headerMarker)) {
    if (document.css.includes(positionMarker)) return updated;
    const header = document.templates.home.children.find(
      (node) => node.settings.classes === "midnight-header",
    );
    if (header) Object.assign(header.settings, structuredClone(headerPosition));
    document.css += "\n" + positionMarker + "\n" + mobileHeaderPosition + "\n";
    delete document.compiled;
    return true;
  }
  const root = document.templates.home;
  const block = (type, settings, children) => ({
    id: "blk_" + crypto.randomUUID(),
    type,
    settings,
    ...(children ? { children } : {}),
  });
  let logo;
  const removeOldIdentity = (node) => {
    if (!node.children) return;
    node.children = node.children.filter((child) => {
      if (
        !logo &&
        child.type === "core/site-brand" &&
        (child.settings.classes || "")
          .split(/\s+/)
          .includes("midnight-identity")
      ) {
        logo = child;
        return false;
      }
      removeOldIdentity(child);
      return true;
    });
  };
  removeOldIdentity(root);
  logo ||= block("core/site-brand", {});
  logo.settings = {
    display: "logo",
    logoHeight: 40,
    level: "span",
    linkHome: false,
    classes: "midnight-brand-logo",
  };
  const identity = block(
    "core/columns",
    {
      classes: "midnight-brand",
      display: "flex",
      gap: 12,
      wrap: false,
      stackOnMobile: false,
      verticalAlign: "center",
    },
    [
      block(
        "core/column",
        { classes: "midnight-brand-logo-column", width: "auto" },
        [logo],
      ),
      block("core/column", { classes: "midnight-brand-copy", width: "auto" }, [
        block("core/row", { gap: 0, wrap: false }, [
          block("core/site-brand", {
            display: "name",
            level: "span",
            linkHome: false,
            classes: "midnight-brand-name",
          }),
        ]),
        block("core/row", { gap: 0, wrap: false }, [
          block("core/tagline", { classes: "midnight-brand-tagline" }),
        ]),
      ]),
    ],
  );
  root.children.push(
    block(
      "core/row",
      {
        classes: "midnight-header",
        gap: 24,
        wrap: false,
        ...structuredClone(headerPosition),
      },
      [
        block("core/button", {
          text: "Login",
          href: "/login",
          iconName: "login",
          iconPosition: "before",
          iconSize: 18,
          classes: "midnight-login",
        }),
        identity,
      ],
    ),
  );
  document.css = document.css.replace(
    "background-image:radial-gradient(circle at 24% 30%,#97bfff30 1px,transparent 2px),linear-gradient(45deg,transparent 49.8%,#a7c8ff18 50%,transparent 50.2%);background-size:100px 100px,220px 220px",
    "background-image:radial-gradient(circle at 24% 30%,#97bfff30 1px,transparent 2px);background-size:100px 100px",
  );
  document.css += `
${headerMarker}
${positionMarker}
${mobileHeaderPosition}
.theme-root.maintenance-midnight .midnight-header{position:fixed;top:32px;left:40px;right:40px;z-index:4}
.theme-root.maintenance-midnight .midnight-header>.theme-layout{display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:nowrap}
.theme-root.maintenance-midnight .midnight-brand{max-width:min(440px,65vw);margin-left:auto}
.theme-root.maintenance-midnight .midnight-brand>.theme-layout{display:flex;align-items:center;gap:12px;flex-wrap:nowrap}
.theme-root.maintenance-midnight .midnight-brand-logo-column{flex:0 0 auto}
.theme-root.maintenance-midnight .midnight-brand-copy{min-width:0;flex:1 1 auto}
.theme-root.maintenance-midnight .midnight-brand .theme-site-name{font-size:16px;font-weight:600;letter-spacing:.02em;line-height:1.4;color:#edf4ff}
.theme-root.maintenance-midnight .midnight-brand .theme-site-tagline{margin:4px 0 0;font-size:12px;line-height:1.5;color:#adbbd3;letter-spacing:.02em}
.theme-root.maintenance-midnight .midnight-login{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid #a7c8ff40;border-radius:10px;background-color:#edf4ff0c;color:#edf4ff;font-size:13px;white-space:nowrap;text-decoration:none;backdrop-filter:blur(12px)}
.theme-root.maintenance-midnight .midnight-login:hover{background-color:#edf4ff20}
.theme-root.maintenance-midnight .midnight-login:focus-visible{outline:2px solid #a7c8ff;outline-offset:3px}
@media(max-width:600px){.theme-root.maintenance-midnight .midnight-header{top:20px;left:16px;right:16px}.theme-root.maintenance-midnight .midnight-header>.theme-layout{gap:12px}.theme-root.maintenance-midnight .midnight-brand .theme-site-name{font-size:13px}.theme-root.maintenance-midnight .midnight-brand .theme-site-tagline{font-size:10px}.theme-root.maintenance-midnight .midnight-brand .theme-site-logo,.theme-root.maintenance-midnight .midnight-brand .site-logo-placeholder{max-height:32px}.theme-root.maintenance-midnight .midnight-login{padding:8px 10px}}
`;
  delete document.compiled;
  return true;
}

// Apply to published layouts and drafts, including previously normalized CSS.
const layoutMarker = "/* Midnight header layout v4 */";
export function upgradeMidnight(document) {
  const updated = upgradeMidnightHeader(document);
  if (
    document?.manifest?.id !== "com.colossal.maintenance.midnight" ||
    document.css?.includes(layoutMarker)
  )
    return updated;
  const header = document.templates.home.children.find(
    (node) => node.settings.classes === "midnight-header",
  );
  if (header) {
    const brand = header.children.find(
      (node) => node.settings.classes === "midnight-brand",
    );
    const login = header.children.find(
      (node) => node.settings.classes === "midnight-login",
    );
    if (brand && login)
      header.children = [
        brand,
        ...header.children.filter((node) => node !== brand && node !== login),
        login,
      ];
  }
  const css = postcss.parse(document.css || "");
  css.walkRules((rule) => {
    if (
      !rule.selector
        .split(",")
        .some((selector) =>
          /\.maintenance-geometry(?:\s*|::?(?:before|after))$/.test(
            selector.trim(),
          ),
        )
    )
      return;
    rule.walkDecls((decl) => {
      if (
        ["background", "background-image", "background-size"].includes(
          decl.prop,
        )
      )
        decl.remove();
    });
  });
  document.css =
    css.toString() +
    "\n" +
    layoutMarker +
    `
.theme-root.maintenance-midnight .maintenance-geometry{background-image:radial-gradient(circle at 24% 30%,#97bfff30 1px,transparent 2px);background-size:100px 100px}
.theme-root.maintenance-midnight .midnight-brand{margin-left:0;margin-right:auto}
`;
  delete document.compiled;
  return true;
}
