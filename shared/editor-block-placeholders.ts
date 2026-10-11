import type { BlockNode } from "./theme-models";
import { canvasBlockId } from "./context-blocks";
import { renderIcon, validIcon } from "./icon-catalog";

const placeholders: Record<string, [string, string, string]> = {
  "core/row": ["Row", "columns", "Drop blocks into this row"],
  "core/container": ["Container", "square", "Drop blocks into this container"],
  "core/columns": ["Columns", "columns", "Add columns to build your layout"],
  "core/column": ["Column", "columns", "Drop blocks into this column"],
  "core/slider": ["Slider", "images", "Add slides to this slider"],
  "core/slide": [
    "Slide",
    "image",
    "Add a background or drop blocks into this slide",
  ],
  "core/group": ["Group", "layer-group", "Drop blocks into this group"],
  "core/menu": ["Menu", "bars", "Add Menu Item or Button blocks"],
  "core/overlay": [
    "Overlay",
    "layer-group",
    "Drop blocks over your slide or 3D model",
  ],
  "core/image": ["Image", "image", "Choose an image in the Inspector"],
  "core/button": ["Button", "arrow-right", "Add button text in the Inspector"],
  "core/icon": ["Icon", "star", "Choose an icon in the Inspector"],
  "core/featured-image": [
    "Featured image",
    "image",
    "Set a featured image for this post or page",
  ],
  "core/gltf": [
    "3D model",
    "cube",
    "Choose a model or portrait in the Inspector",
  ],
  "core/media": [
    "Media",
    "play",
    "Choose a video or audio file in the Inspector",
  ],
};

/** Editor DOM only: never modifies the block document or public renderer. */
export function installEditorBlockPlaceholders(
  doc: Document,
  find: (id: string) => BlockNode | undefined,
  rootId: string,
) {
  doc
    .querySelectorAll(".cl-editor-block-placeholder")
    .forEach((placeholder) => placeholder.remove());
  doc
    .querySelectorAll<HTMLElement>(
      ".cl-editor-empty,.cl-editor-placeholder-fallback",
    )
    .forEach((element) => {
      for (const name of Array.from(element.classList))
        if (
          name === "cl-editor-placeholder-fallback" ||
          name.startsWith("cl-editor-empty")
        )
          element.classList.remove(name);
    });
  if (!doc.getElementById("cl-editor-placeholder-styles")) {
    const style = doc.createElement("style");
    style.id = "cl-editor-placeholder-styles";
    style.textContent = `
      .cl-editor-block-placeholder{box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:96px;width:100%;padding:20px;border:1px dashed #8994a588;border-radius:8px;background:#8994a514;color:#738595;font:12px/1.5 system-ui;text-align:center;cursor:pointer}
      .cl-editor-block-placeholder strong{font-size:13px;color:inherit}
      .cl-editor-block-placeholder svg{flex-shrink:0;opacity:.85}
      .cl-editor-empty-media>.cl-editor-block-placeholder{min-height:160px}
      .cl-editor-empty-button>.cl-editor-block-placeholder,.cl-editor-empty-icon>.cl-editor-block-placeholder{min-height:48px;min-width:100px;padding:10px}
      .cl-editor-empty-slider>.cl-swiper{position:relative}
      .cl-editor-empty-slider>.cl-swiper>.cl-editor-block-placeholder{position:absolute;inset:0;z-index:2;height:100%;pointer-events:none}
      .cl-editor-placeholder-fallback{display:none!important}
    `;
    doc.head.appendChild(style);
  }
  for (const element of Array.from(
    doc.querySelectorAll<HTMLElement>("[data-block-id]"),
  )) {
    const id = canvasBlockId(element);
    const node = find(id);
    if (!node || id === rootId || !placeholders[node.type]) continue;
    const s = node.settings;
    let empty = false;
    let target = element;
    switch (node.type) {
      case "core/menu":
        empty =
          !node.children?.length &&
          !element.querySelector(".theme-menu-items a,.theme-menu-link");
        break;
      case "core/image":
      case "core/featured-image":
        empty = !element.querySelector("img[src]");
        break;
      case "core/media":
        empty = !element.querySelector("video[src],audio[src]");
        break;
      case "core/gltf":
        empty = !element.querySelector("[data-model-url],[data-portrait-url]");
        break;
      case "core/button":
        empty =
          !String(s.text ?? "Button").trim() && !element.querySelector("svg");
        break;
      case "core/icon":
        empty = !validIcon(s.iconName);
        break;
      case "core/slide":
        empty =
          !node.children?.length &&
          !element.querySelector(".cl-slide-background");
        break;
      case "core/slider":
        empty =
          (!node.children?.length ||
            node.children.every((slide) => !slide.children?.length)) &&
          !element.querySelector(".cl-slide-background");
        target =
          element.querySelector<HTMLElement>(":scope > .cl-swiper") || element;
        break;
      default:
        empty = !node.children?.length;
    }
    if (
      node.type === "core/slide" &&
      element.closest(".cl-editor-empty-slider")
    )
      continue;
    if (!empty || target.querySelector(":scope > .cl-editor-block-placeholder"))
      continue;
    const [label, icon, hint] = placeholders[node.type];
    // Hide old fallback markup, preserving overlays, slider controls and real blocks.
    if (
      ["core/image", "core/media", "core/gltf", "core/icon"].includes(node.type)
    ) {
      for (const child of Array.from(element.children)) {
        if (!child.hasAttribute("data-block-id"))
          child.classList.add("cl-editor-placeholder-fallback");
      }
    }
    element.classList.add("cl-editor-empty");
    if (
      ["core/image", "core/featured-image", "core/media", "core/gltf"].includes(
        node.type,
      )
    )
      element.classList.add("cl-editor-empty-media");
    else element.classList.add("cl-editor-empty-" + node.type.slice(5));
    const placeholder = doc.createElement("span");
    placeholder.className = "cl-editor-block-placeholder";
    placeholder.setAttribute("role", "note");
    placeholder.setAttribute("aria-label", label + " placeholder");
    placeholder.innerHTML = renderIcon({
      iconName: validIcon(icon) ? icon : "square",
      iconSize: 28,
    });
    const title = doc.createElement("strong");
    title.textContent = label;
    const description = doc.createElement("span");
    description.textContent = hint;
    placeholder.append(title, description);
    target.appendChild(placeholder);
  }
}
