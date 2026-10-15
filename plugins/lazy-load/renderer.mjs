import { parseDocument } from "htmlparser2";
import { findAll, getOuterHTML } from "domutils";
import { defaults } from "./config.mjs";
const escapeAttribute = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
export function lazyLoadCss(settings) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="${settings.spinnerColor}" stroke-opacity=".2" stroke-width="3"/><path d="M20 4a16 16 0 0 1 16 16" fill="none" stroke="${settings.spinnerColor}" stroke-width="3" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur=".8s" repeatCount="indefinite"/></path></svg>`;
  const still = svg.replace(/<animateTransform[^>]*\/>/, "");
  return `.theme-root img.cl-lazy-pending{background-image:url("data:image/svg+xml,${encodeURIComponent(svg)}")!important;background-repeat:no-repeat!important;background-position:center!important;background-size:${settings.spinnerSize}px ${settings.spinnerSize}px!important}@media(prefers-reduced-motion:reduce){.theme-root img.cl-lazy-pending{background-image:url("data:image/svg+xml,${encodeURIComponent(still)}")!important}}`;
}
/** Preserve picture/srcset, links and the theme's exact image hierarchy. */
export function decorateImages(rendered, settings = defaults) {
  if (
    !settings.enabled ||
    rendered.preview ||
    !rendered.html ||
    rendered.html.includes("data-cl-lazy-config=")
  )
    return rendered;
  const tree = parseDocument(rendered.html, { decodeEntities: true });
  const images = findAll((node) => node.name === "img", tree.children);
  let first = true;
  for (const image of images) {
    const attrs = image.attribs;
    let skip = false;
    for (let parent = image; parent?.attribs; parent = parent.parent) {
      if (
        Object.hasOwn(parent.attribs, "data-no-lazy") ||
        /(?:^|\s)(?:no-lazy|theme-part-header|theme-site-identity|cl-ice-world)(?:\s|$)/.test(
          parent.attribs.class || "",
        )
      )
        skip = true;
    }
    if (skip || !attrs.src || /^(?:data:|blob:)/i.test(attrs.src)) continue;
    const priority = first && settings.skipFirstImage;
    first = false;
    attrs["data-cl-lazy-image"] = "";
    attrs.class = [attrs.class, "cl-lazy-pending"].filter(Boolean).join(" ");
    if (priority) attrs.loading = "eager";
    if (
      !priority &&
      attrs.loading !== "eager" &&
      attrs.fetchpriority !== "high"
    )
      attrs.loading = "lazy";
    attrs.decoding ||= "async";
  }
  const config = escapeAttribute(JSON.stringify(settings));
  return {
    ...rendered,
    html: `<span hidden data-cl-lazy-config="${config}"></span>${getOuterHTML(tree)}<noscript><style>.theme-root img.cl-lazy-pending{background-image:none!important}</style></noscript>`,
    css: (rendered.css || "") + "\n" + lazyLoadCss(settings),
  };
}
