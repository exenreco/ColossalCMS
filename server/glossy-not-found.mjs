/** One-time Glossy 404 redesign, shared by new installs and stored theme documents. */
export function upgradeGlossyNotFound(document) {
  const marker = "/* Glossy interactive particle 404 */";
  if (!document.templates?.["not-found"] || document.css?.includes(marker))
    return;
  const definition = {
    type: "glossy/particle-text",
    label: "Particle text",
    category: "Theme",
    icon: "fas fa-snowflake",
    container: false,
    fields: [
      { key: "text", label: "Particle text", type: "text", default: "404" },
      {
        key: "color",
        label: "Particle color",
        type: "text",
        default: "#c5e5ff",
      },
      {
        key: "radius",
        label: "Interaction radius",
        type: "number",
        default: 130,
        min: 40,
        max: 240,
      },
      {
        key: "strength",
        label: "Interaction strength",
        type: "number",
        default: 1,
        min: 0,
        max: 3,
      },
    ],
    template:
      '<div class="glossy-particle-text" data-particle-text="{{setting.text}}" data-particle-color="{{setting.color}}" data-particle-radius="{{setting.radius}}" data-particle-strength="{{setting.strength}}"><h1 class="glossy-particle-fallback">{{setting.text}}</h1></div>',
  };
  document.blocks ||= [];
  if (!document.blocks.some((block) => block.type === definition.type))
    document.blocks.push(definition);
  if (!document.manifest.blocks.some((block) => block.type === definition.type))
    document.manifest.blocks.push({
      type: definition.type,
      file: "blocks/particle-text.html",
      label: definition.label,
      icon: definition.icon,
      container: false,
    });
  const make = (type, settings = {}, children) => ({
    id: "glossy-error-" + crypto.randomUUID(),
    type,
    settings,
    ...(children ? { children } : {}),
  });
  const root = document.templates["not-found"];
  if (!root.children?.some((node) => node.type === "glossy/particle-text")) {
    root.settings = {
      ...root.settings,
      classes: "c27-body c27-not-found",
      background: "#0c0d10",
    };
    root.children = [
      make("glossy/particle-text", {
        text: "404",
        color: "#c5e5ff",
        radius: 130,
        strength: 1,
        classes: "c27-error-scene",
      }),
      make("core/row", { classes: "c27-error-topbar" }, [
        make("core/site-brand", {
          display: "name",
          linkHome: true,
          fontSize: 18,
        }),
        make("core/paragraph", {
          html: "ERROR / 404",
          classes: "c27-error-label",
        }),
      ]),
      make("core/container", { classes: "c27-error-message" }, [
        make("core/heading", {
          text: "A little off the map.",
          level: "h2",
          fontSize: 32,
          lineHeight: 40,
        }),
        make("core/paragraph", {
          html: "The page you’re looking for has moved or doesn’t exist. Let’s get you back to somewhere familiar.",
          fontSize: 15,
          lineHeight: 24,
        }),
        make("core/post-content"),
        make("core/button", {
          text: "Back to home",
          href: "/",
          iconName: "arrow-left",
          iconPosition: "before",
          classes: "c27-error-home",
        }),
      ]),
      make("core/paragraph", {
        html: "MOVE TO EXPLORE · CLICK TO SCATTER",
        classes: "c27-error-hint",
      }),
    ];
  }
  document.css =
    (document.css || "") +
    `
${marker}
.theme-root.c27-not-found{position:relative;width:100%;max-width:none;min-height:100vh;margin:0;padding:0;overflow:hidden;background-color:#0c0d10;background-image:radial-gradient(ellipse at 50% 38%,#20253188,transparent 65%)}
.theme-root .c27-error-scene{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;z-index:0}
.theme-root .glossy-particle-text{position:relative;width:100%;height:100%;color:#c5e5ff}
.theme-root .glossy-particle-text canvas{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none}
.theme-root .glossy-particle-fallback{position:absolute;top:16%;left:0;width:100%;text-align:center;font-size:clamp(140px,29vw,420px);font-weight:900;line-height:1;letter-spacing:-12px;margin:0;color:#c5e5ff}
.theme-root .glossy-particle-text[data-particle-mounted] .glossy-particle-fallback{opacity:0}
.theme-root .c27-error-topbar{position:absolute;top:0;left:0;right:0;z-index:2;padding:32px 48px}
.theme-root .c27-error-topbar>.theme-layout{justify-content:space-between;align-items:center;width:100%}
.theme-root .c27-error-topbar .theme-site-name{font-size:18px;line-height:24px;letter-spacing:-0.4px;margin:0}
.theme-root .c27-error-label p{font-size:11px;letter-spacing:2px;color:#9297a0;margin:0}
.theme-root .c27-error-message{position:relative;z-index:2;max-width:560px;text-align:center;margin:0 auto;padding:64vh 24px 100px}
.theme-root .c27-error-message h2{font-size:32px;line-height:40px;letter-spacing:-1px;margin:0 0 16px}
.theme-root .c27-error-message p{font-size:15px;line-height:24px;color:#a4a9b2;margin:0 0 28px}
.theme-root .c27-error-home.theme-button{display:inline-flex;align-items:center;gap:10px;padding:14px 24px;background-color:#17191bc9;border:1px solid #ffffff30;border-radius:32px;backdrop-filter:blur(20px);color:#f1f2f4;font-size:14px}
.theme-root .c27-error-home.theme-button:hover{background-color:#303740;border-color:#c5e5ff}
.theme-root .c27-error-hint{position:absolute;bottom:24px;left:0;right:0;text-align:center;z-index:2}
.theme-root .c27-error-hint p{font-size:10px;letter-spacing:2px;color:#9297a0;margin:0}
@media(max-width:600px){.theme-root .c27-error-topbar{padding:24px}.theme-root .c27-error-message{padding-top:58vh;padding-bottom:100px}.theme-root .c27-error-message h2{font-size:26px;line-height:34px}.theme-root .c27-error-hint p{font-size:8px;letter-spacing:1px}}
@media(prefers-reduced-motion:reduce){.theme-root .c27-error-hint{display:none}}
`;
  delete document.compiled;
}
