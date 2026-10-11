import type { BlockDefinition } from "./theme-models";
import { iconDrawing } from "./icon-catalog";

/** Canvas-local block picker shared by theme, post and page paragraph editors. */
export class CanvasBlockSearch {
  private panel?: HTMLElement;
  private anchor?: HTMLElement;
  private choices: BlockDefinition[] = [];
  private index = 0;
  constructor(private pick: (type: string) => void) {}
  get open() {
    return !!this.panel;
  }
  contains(target: Node) {
    return !!this.panel?.contains(target);
  }
  show(
    anchor: HTMLElement,
    choices: BlockDefinition[],
    query: string,
    caret: Range,
  ) {
    const doc = anchor.ownerDocument;
    if (!doc.getElementById("cl-slash-menu-style")) {
      const style = doc.createElement("style");
      style.id = "cl-slash-menu-style";
      style.textContent = `
        .cl-slash-menu{position:fixed;z-index:2147483647;width:280px;max-width:calc(100vw - 16px);padding:6px;border:1px solid var(--cl-editor-border,#444);border-radius:12px;background:var(--cl-editor-surface,#202225);color:var(--cl-editor-text,#eee);box-shadow:0 12px 36px #0004;font:13px/1.4 system-ui}
        .cl-slash-menu-header{padding:8px;color:var(--cl-editor-muted,#aaa);font-size:11px}
        .cl-slash-menu-list{max-height:240px;overflow:auto}
        .cl-slash-menu .cl-slash-option{display:flex;align-items:center;gap:10px;width:100%;border:0;border-radius:6px;background:transparent;color:inherit;text-align:left;padding:9px;font:inherit;cursor:pointer}
        .cl-slash-menu .cl-slash-option[aria-selected=true]{background:var(--cl-editor-bg,#303436);outline:1px solid var(--cl-editor-border,#555)}
        .cl-slash-option svg{width:18px;height:18px;flex:none}
        .cl-slash-option small{display:block;color:var(--cl-editor-muted,#aaa);font-size:10px}
      `;
      doc.head.append(style);
    }
    this.close();
    this.anchor = anchor;
    this.choices = choices;
    this.index = 0;
    const panel = doc.createElement("div");
    panel.className = "cl-slash-menu";
    panel.setAttribute("aria-label", "Search blocks");
    const header = doc.createElement("div");
    header.className = "cl-slash-menu-header";
    header.textContent = query
      ? `Blocks matching “${query}”`
      : "Search blocks · type to filter";
    const list = doc.createElement("div");
    list.className = "cl-slash-menu-list";
    list.id = "cl-slash-results";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Matching blocks");
    for (const [index, block] of choices.entries()) {
      const option = doc.createElement("button");
      option.type = "button";
      option.tabIndex = -1;
      option.className = "cl-slash-option";
      option.id = "cl-slash-option-" + index;
      option.dataset["slashBlock"] = block.type;
      option.setAttribute("role", "option");
      const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "1.6");
      svg.setAttribute("aria-hidden", "true");
      for (const drawing of iconDrawing(block.icon || "")) {
        const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", drawing);
        svg.append(path);
      }
      const label = doc.createElement("span");
      label.textContent = block.label;
      const category = doc.createElement("small");
      category.textContent = block.category;
      label.append(category);
      option.append(svg, label);
      option.addEventListener("pointerdown", (event) => event.preventDefault());
      option.addEventListener("click", () => this.pick(block.type));
      option.addEventListener("pointermove", () => {
        this.index = index;
        this.highlight();
      });
      list.append(option);
    }
    if (!choices.length) {
      const empty = doc.createElement("div");
      empty.className = "cl-slash-menu-header";
      empty.setAttribute("role", "status");
      empty.textContent = "No matching blocks";
      list.append(empty);
    }
    panel.append(header, list);
    // Outside the theme root so theme selectors cannot change picker appearance.
    doc.body.append(panel);
    this.panel = panel;
    anchor.setAttribute("aria-controls", list.id);
    anchor.setAttribute("aria-autocomplete", "list");
    anchor.setAttribute("aria-expanded", "true");
    this.highlight();
    const rect = caret.getBoundingClientRect();
    const fallback = anchor.getBoundingClientRect();
    const left = rect.width || rect.height ? rect.left : fallback.left;
    const bottom = rect.width || rect.height ? rect.bottom : fallback.bottom;
    const view = doc.defaultView!;
    panel.style.left =
      Math.max(8, Math.min(left, view.innerWidth - panel.offsetWidth - 8)) +
      "px";
    panel.style.top =
      Math.max(
        8,
        bottom + panel.offsetHeight + 8 > view.innerHeight
          ? (rect.top || fallback.top) - panel.offsetHeight - 8
          : bottom + 8,
      ) + "px";
  }
  key(event: KeyboardEvent) {
    if (
      !this.open ||
      !["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab"].includes(event.key)
    )
      return false;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape" || event.key === "Tab") this.close();
    else if (event.key === "Enter") {
      if (this.choices[this.index]) this.pick(this.choices[this.index].type);
    } else if (this.choices.length) {
      this.index =
        (this.index +
          (event.key === "ArrowDown" ? 1 : -1) +
          this.choices.length) %
        this.choices.length;
      this.highlight();
      this.panel
        ?.querySelectorAll(".cl-slash-option")
        [this.index]?.scrollIntoView({ block: "nearest" });
    }
    return true;
  }
  private highlight() {
    this.panel
      ?.querySelectorAll(".cl-slash-option")
      .forEach((option, index) =>
        option.setAttribute("aria-selected", String(index === this.index)),
      );
    if (this.choices.length)
      this.anchor?.setAttribute(
        "aria-activedescendant",
        "cl-slash-option-" + this.index,
      );
  }
  close() {
    this.panel?.remove();
    this.panel = undefined;
    for (const name of [
      "aria-controls",
      "aria-autocomplete",
      "aria-expanded",
      "aria-activedescendant",
    ])
      this.anchor?.removeAttribute(name);
    this.anchor = undefined;
  }
}
