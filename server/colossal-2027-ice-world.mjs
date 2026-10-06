/** Upgrade the bundled hero without rebuilding authored copy, other templates or shared parts. */
export function upgradeColossal2027Document(input) {
  if (!input?.templates?.home || input.manifest?.bundledRevision >= 3)
    return input;
  const d = structuredClone(input);
  const hero = d.templates.home.children?.find((node) =>
    String(node.settings?.classes || "")
      .split(/\s+/)
      .includes("c27-hero"),
  );
  if (!hero) return input;
  const art = hero.children?.find((node) =>
    String(node.settings?.classes || "").includes("c27-hero-art"),
  );
  const scene = art?.children?.find(
    (node) => node.type === "core/gltf" && node.settings?.source === "portrait",
  );
  if (!scene) return input;
  if (!(d.manifest.bundledRevision >= 2)) {
    hero.settings.classes += " c27-hero-world";
    hero.settings.position = "relative";
    hero.settings.zIndex = 1;
    art.settings.position = "absolute";
    art.settings.offsets = { top: 0, right: 0, bottom: 0, left: 0 };
    art.settings.zIndex = 0;
    const copy = hero.children.find((node) =>
      String(node.settings?.classes || "").includes("c27-hero-copy"),
    );
    if (copy) {
      copy.settings.position = "relative";
      copy.settings.zIndex = 2;
    }
    Object.assign(scene.settings, {
      scenePreset: "ice-world",
      fullViewport: true,
      moonEnabled: true,
      moonSize: 4.5,
      moonElevation: 0,
      moonTint: "#b9dcef",
      terrainEnabled: true,
      snowEnabled: true,
      snowDensity: 700,
      windEnabled: true,
      windStrength: 1,
    });
    if (
      !scene.settings.portraitUrl ||
      scene.settings.portraitUrl === "/themes/colossal-2027/ice-portrait.png"
    ) {
      scene.settings.portraitUrl = "/themes/colossal-2027/ice-throne.png";
      scene.settings.alt =
        "Exenreco Bell sculpted in translucent ice, seated on a majestic crystalline throne";
      scene.settings.ariaLabel =
        "Interactive ice throne and moonlit winter landscape. Scroll to reveal wind and snow, or use arrow keys to explore.";
    }
    if (scene.settings.fragmentCount === 20) scene.settings.fragmentCount = 8;
    for (const node of d.templates.home.children) {
      if (node.type !== "theme/part-header" && node !== hero) {
        node.settings.position = "relative";
        node.settings.zIndex = 2;
      }
    }
    d.css = (d.css || "") + COLOSSAL_2027_ICE_CSS;
    d.manifest.bundledRevision = 2;
  }
  scene.settings.moonPlacement ??= "top-left";
  scene.settings.sceneSpeed ??= 1.35;
  scene.settings.backgroundZoom ??= 0.1;
  scene.settings.snowSize ??= 1.2;
  scene.settings.snowSpeed ??= 1.4;
  scene.settings.snowFlutter ??= 1.3;
  scene.settings.sceneVeilEnabled ??= true;
  scene.settings.sceneVeilOpacity ??= 0.5;
  scene.settings.scenePixelsEnabled ??= true;
  scene.settings.scenePixelSize ??= 3;
  if (scene.settings.snowDensity === 700) scene.settings.snowDensity = 160;
  if (scene.settings.fragmentCount === 8) scene.settings.fragmentCount = 0;
  if (scene.settings.portraitUrl === "/themes/colossal-2027/ice-throne.png")
    scene.settings.portraitUrl = "/themes/colossal-2027/ice-throne-royal.png";
  d.css = (d.css || "") + COLOSSAL_2027_GLASS_CSS;
  d.manifest.bundledRevision = 3;
  return d;
}

export const COLOSSAL_2027_GLASS_CSS = `
/* Colossal 2027 / charcoal glass and animated pixel veil */
.theme-root.c27-body{background-color:#0c0d10;background-image:none}
.theme-root .c27-header-inner{background-image:none;background-color:#cbd4e012;border-color:#ffffff26}
.theme-root .c27-hero-world .c27-hero-copy{background-image:none}
.theme-root .c27-hero-world .c27-hero-eyebrow{color:#b7bec9}
.theme-root .c27-hero-world .c27-hero-description{color:#b2bbc9}
.theme-root .c27-intro-line{background-color:transparent;background-image:none;padding:28px 0;border-radius:0;color:#a4adbb}
.theme-root .c27-work,.theme-root .c27-about,.theme-root .c27-resume{background-color:transparent;background-image:none;backdrop-filter:none;padding:80px 0;border-radius:0}
.theme-root .c27-contact{background-color:#c5d7e709;background-image:none}
.theme-root .theme-part-footer{background-color:transparent;background-image:none;backdrop-filter:none;border-radius:0}
.theme-root .c27-hero-world .c27-hero-footnote{color:#9aa5b5}
.theme-root .c27-section-heading p,.theme-root .c27-about-copy p{color:#a8b2c2}
.theme-root .c27-section-label{color:#a5afbf}
@media(max-width:850px){.theme-root .c27-work,.theme-root .c27-about,.theme-root .c27-resume{padding:64px 0}}
@media(max-width:600px){.theme-root .c27-hero-world .c27-hero-copy{background-image:none;background-color:#0c0d107a;backdrop-filter:blur(10px) saturate(110%);border:1px solid #ffffff12}.theme-root .c27-work,.theme-root .c27-about,.theme-root .c27-resume{padding:40px 0}}
`;

export const COLOSSAL_2027_ICE_CSS = `
/* Colossal 2027 / full viewport ice world */
.theme-root.c27-body{background-color:#06111e;background-image:linear-gradient(145deg,#132a40,#050c15)}
.theme-root .theme-part-header{height:76px}
.theme-root .c27-header-inner{height:76px;background-image:linear-gradient(145deg,#c5d8e511,#b2c5d008)}
.theme-root .c27-hero.c27-hero-world{display:flex;flex-direction:row;align-items:center;min-height:0;height:100vh;height:100svh;width:100vw;max-width:100%;margin:-94px 0 0;padding:100px 48px 40px;gap:0}
.theme-root .c27-hero-world .c27-hero-art{width:100%;height:100%;min-width:0;background-image:none}
.theme-root .c27-hero-world .c27-hero-art .gltf-viewer{width:100%;height:100vh!important;height:100svh!important;max-width:none;border-radius:0}
.theme-root .c27-hero-world .c27-hero-copy{width:43%;max-width:530px;padding:24px 0;background-image:none}
.theme-root .c27-hero-world h1{font-size:clamp(48px,5.5vw,82px);letter-spacing:-3px}
.theme-root .c27-hero-world .c27-hero-description{color:#b3c3d2;max-width:360px;font-size:13px}
.theme-root .c27-hero-world .c27-hero-actions{gap:18px}
.theme-root .c27-hero-world .c27-hero-footnote{color:#8296a9;margin-top:24px}
.theme-root .c27-hero-world .c27-availability{margin-bottom:22px}
.theme-root .c27-hero-world .c27-art-caption{display:none}
.theme-root .c27-intro-line{background-color:#071321dc;padding:28px 32px;border-radius:0 0 20px 20px}
.theme-root .c27-work,.theme-root .c27-about,.theme-root .c27-resume{background-color:#071321d9;backdrop-filter:blur(12px) saturate(115%);padding:72px 36px;border-radius:28px;margin-top:48px;margin-bottom:48px}
.theme-root .c27-contact{background-color:#071321dc}
.theme-root .theme-part-footer{background-color:#071321e6;backdrop-filter:blur(16px) saturate(115%);border-radius:28px 28px 0 0}
.theme-root .cl-ice-world .cl-portrait-fallback{width:100%;height:100%;object-fit:contain;object-position:72% center}
@media(max-width:850px){.theme-root .c27-hero.c27-hero-world{padding-left:32px;padding-right:32px}.theme-root .c27-hero-world .c27-hero-copy{width:46%}.theme-root .c27-hero-world h1{font-size:clamp(38px,6vw,58px)}.theme-root .c27-hero-world .c27-secondary{display:none}.theme-root .c27-work,.theme-root .c27-about,.theme-root .c27-resume{padding:48px 28px}.theme-root .c27-hero-world .c27-hero-description{font-size:11px}}
@media(max-width:600px){.theme-root .theme-part-header,.theme-root .c27-header-inner{height:62px}.theme-root .c27-hero.c27-hero-world{margin-top:-72px;align-items:flex-end;padding:90px 24px 24px}.theme-root .c27-hero-world .c27-hero-copy{width:100%;max-width:none;padding:12px 16px;border-radius:20px;background-image:linear-gradient(0deg,#07132199,#07132100)}.theme-root .c27-hero-world h1{font-size:clamp(30px,8.4vw,42px);letter-spacing:-1.5px;line-height:1.08;margin-bottom:18px;max-width:270px}.theme-root .c27-hero-world .c27-hero-eyebrow{font-size:8px;margin-bottom:10px}.theme-root .c27-hero-world .c27-availability,.theme-root .c27-hero-world .c27-hero-description,.theme-root .c27-hero-world .c27-hero-footnote{display:none}.theme-root .c27-hero-world .c27-cta{font-size:11px;padding:12px 18px}.theme-root .c27-work,.theme-root .c27-about,.theme-root .c27-resume{padding:40px 24px;margin-top:24px;margin-bottom:24px}.theme-root .cl-ice-world .cl-portrait-fallback{object-position:center top}}
@media(max-height:650px) and (min-width:601px){.theme-root .c27-hero-world h1{font-size:42px;margin-bottom:18px}.theme-root .c27-hero-world .c27-availability,.theme-root .c27-hero-world .c27-hero-footnote{display:none}.theme-root .c27-hero-world .c27-hero-copy{padding:0}.theme-root .c27-hero-world .c27-hero-eyebrow{margin-bottom:16px}}
`;
