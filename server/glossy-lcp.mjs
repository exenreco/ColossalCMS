import { parseDocument } from "htmlparser2";
import { findAll, getOuterHTML } from "domutils";
import assets from "../shared/glossy-hero-assets.json" with { type: "json" };
import { throneFallbackStyle } from "../shared/ice-scene/scene-math.ts";

export function optimizeGlossyRender(rendered, preview = false) {
  const id = rendered.body?.themeId || "";
  const glossyCopy =
    String(rendered.body?.className || "")
      .split(/\s+/)
      .includes("c27-body") &&
    /\.c27-header-inner\b/.test(rendered.css || "") &&
    /\.c27-hero\b/.test(rendered.css || "");
  if (
    preview ||
    !(
      id === "com.colossal.theme.colossal-2027" ||
      id.startsWith("com.colossal.theme.colossal-2027.") ||
      glossyCopy
    )
  )
    return rendered;
  const tree = parseDocument(rendered.html, { decodeEntities: true });
  const scenes = findAll(
    (node) =>
      node.attribs?.["data-full-viewport"] === "true" &&
      node.attribs?.["data-scene-preset"] === "ice-world",
    tree.children,
  );
  let lcpImage;
  let fallbackCss = "";
  for (const scene of scenes) {
    const image = findAll(
      (node) =>
        node.name === "img" &&
        (node.attribs.class || "")
          .split(/\s+/)
          .includes("cl-portrait-fallback"),
      scene.children,
    )[0];
    if (!image?.attribs.src) continue;
    const optimized = assets[image.attribs.src];
    if (optimized) {
      Object.assign(image.attribs, {
        src: optimized.src,
        srcset: optimized.srcset,
        sizes: "100vw",
        width: String(optimized.width),
        height: String(optimized.height),
      });
      scene.attribs["data-portrait-url"] = optimized.src;
    }
    image.attribs.loading = "eager";
    image.attribs.decoding = "async";
    image.attribs["data-no-lazy"] = "";
    if (!lcpImage) {
      image.attribs.fetchpriority = "high";
      lcpImage = {
        src: image.attribs.src,
        srcset: image.attribs.srcset,
        sizes: image.attribs.sizes,
      };
    }
    scene.attribs["data-progressive-scene"] = "true";
    if (optimized) {
      // Keep the no-WebGL/first-paint artwork in the same frame as the live model.
      const key = `glossy-scene-${scenes.indexOf(scene)}`;
      scene.attribs["data-static-frame"] = key;
      const aspect = optimized.width / optimized.height;
      const selector = `.cl-ice-world[data-static-frame=${key}]>.cl-portrait-fallback`;
      fallbackCss += `${selector}{${throneFallbackStyle(aspect)}}@media(max-aspect-ratio:9/10){${selector}{${throneFallbackStyle(aspect, true)}}}`;
    }
    const color = /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(
      scene.attribs["data-scene-veil-color"] || "",
    )
      ? scene.attribs["data-scene-veil-color"].slice(0, 7)
      : "#17191b";
    const opacity =
      scene.attribs["data-scene-veil-enabled"] === "false"
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              Number(scene.attribs["data-scene-veil-opacity"] ?? 0.92),
            ),
          );
    scene.attribs.style =
      (scene.attribs.style || "") +
      `;--static-veil-color:${color};--static-veil-opacity:${opacity}`;
    const veil = parseDocument(
      '<span class="cl-scene-static-veil" aria-hidden="true"></span>',
    ).children[0];
    veil.parent = scene;
    scene.children.push(veil);
  }
  const css = `.cl-ice-world[data-progressive-scene=true]{opacity:1!important}.cl-scene-static-veil{position:absolute;inset:0;background:var(--static-veil-color);opacity:var(--static-veil-opacity);pointer-events:none;z-index:1}@media(max-width:600px){.cl-ice-world[data-scene-veil-mobile-gradient=true] .cl-scene-static-veil{opacity:.77}}`;
  const customFont = /(?:font-family|font):[^;}]*\b(?:Manrope|DM Sans)/i.test(
    rendered.css + rendered.body.style + rendered.html,
  );
  return {
    ...rendered,
    html: getOuterHTML(tree),
    css: rendered.css + css + fallbackCss,
    lcpImage,
    fontProfile: customFont ? "custom" : "system",
    frontendMode: "enhance",
  };
}
