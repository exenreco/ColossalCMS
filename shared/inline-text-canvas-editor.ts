import type { ThemeEditorState } from "./theme-editor-state";
import { canvasBlockId } from "./context-blocks";
import { CanvasBlockSearch } from "./canvas-block-search";
import { setTableCellText } from "./table-block";
import { installTableCanvasTools } from "./table-canvas-tools";

/** Inline heading and paragraph authoring shared by all editor canvases. */
export class InlineTextCanvasEditor {
  private document?: Document;
  private events?: AbortController;
  private rootId = "";
  private pendingFocus = "";
  private pendingFocusAtStart = false;
  private lastInput = { id: "", at: 0, snapshot: "" };
  private tableResizing = false;
  private slash = new CanvasBlockSearch((type) => this.chooseSlashBlock(type));
  private slashParagraph?: HTMLElement;
  private slashRange?: Range;
  private slashDismissed = false;
  constructor(
    private state: ThemeEditorState,
    private options: {
      select: (id: string) => void;
      focus: () => void;
      edited: () => void;
      blocks: () => import("./theme-models").BlockDefinition[];
    },
  ) {}
  get editing() {
    if (this.tableResizing) return true;
    const active = this.document?.activeElement as HTMLElement | null;
    if (active?.matches("[data-inline-table-editor]"))
      return (
        this.state.find(active.dataset["inlineTableEditor"] || "")?.type ===
        "core/table"
      );
    return (
      !!active?.matches("[data-inline-text-editor]") &&
      ["core/paragraph", "core/heading"].includes(
        this.state.find(active.dataset["inlineTextEditor"] || "")?.type || "",
      )
    );
  }
  /** Retire the previous canvas immediately when its template or shared part changes. */
  syncScope() {
    if (!this.document || this.rootId === this.state.root?.id) return;
    const previous = this.document;
    this.destroy();
    for (const paragraph of Array.from(
      previous.querySelectorAll<HTMLElement>(
        "[data-inline-text-editor],[data-inline-table-editor]",
      ),
    )) {
      paragraph.blur();
      for (const attribute of [
        "contenteditable",
        "data-paragraph-editor",
        "data-heading-editor",
        "data-inline-text-editor",
        "data-inline-table-editor",
        "data-empty",
        "data-placeholder",
        "role",
        "aria-label",
        "aria-multiline",
      ])
        paragraph.removeAttribute(attribute);
    }
  }
  attach(document: Document) {
    this.closeSlash();
    this.events?.abort();
    this.events = new AbortController();
    this.document = document;
    this.rootId = this.state.root?.id || "";
    const options = { signal: this.events.signal };
    document.addEventListener(
      "pointerdown",
      (event) => {
        const target = event.target as Node;
        if (
          !this.slash.contains(target) &&
          !this.slashParagraph?.contains(target)
        )
          this.closeSlash();
      },
      options,
    );
    const style = document.createElement("style");
    document.getElementById("cl-inline-text-styles")?.remove();
    style.id = "cl-inline-text-styles";
    style.textContent = `
      [data-inline-text-editor]{min-height:1.5em;cursor:text;outline:none;overflow-wrap:anywhere}
      [data-inline-table-editor]{cursor:text;outline:none;min-width:60px}
      [data-inline-text-editor][data-empty="true"]::before{content:attr(data-placeholder);opacity:.45;pointer-events:none;position:absolute}
    `;
    document.head.append(style);
    for (const block of Array.from(
      document.querySelectorAll<HTMLElement>("[data-block-id]"),
    )) {
      const id = canvasBlockId(block);
      const type = this.state.find(id)?.type;
      if (type === "core/table") {
        this.attachTable(block, id, options);
        continue;
      }
      if (!["core/paragraph", "core/heading"].includes(type || "")) continue;
      const heading = type === "core/heading";
      const paragraph = block.querySelector<HTMLElement>(
        heading
          ? ":scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > h5,:scope > h6"
          : ":scope > p",
      );
      if (!paragraph) continue;
      paragraph.contentEditable = "true";
      paragraph.spellcheck = true;
      paragraph.dataset["inlineTextEditor"] = id;
      paragraph.dataset[heading ? "headingEditor" : "paragraphEditor"] = id;
      paragraph.dataset["placeholder"] = heading
        ? "Write a heading…"
        : "Start writing…";
      paragraph.setAttribute("role", "textbox");
      paragraph.setAttribute(
        "aria-label",
        heading ? "Heading text" : "Paragraph text",
      );
      paragraph.setAttribute("aria-multiline", "true");
      this.empty(paragraph);
      paragraph.addEventListener(
        "focus",
        () => {
          this.closeSlash();
          if (this.state.find(id)?.type !== type) return;
          this.options.focus();
          this.options.select(id);
        },
        options,
      );
      paragraph.addEventListener(
        "blur",
        () => {
          this.closeSlash();
          this.lastInput.id = "";
          const signal = this.events!.signal;
          queueMicrotask(() => {
            if (!signal.aborted && !this.editing) this.options.edited();
          });
        },
        options,
      );
      paragraph.addEventListener("input", () => this.input(paragraph), options);
      paragraph.addEventListener(
        "paste",
        (event) => {
          event.preventDefault();
          const text = event.clipboardData?.getData("text/plain") || "";
          const fragment = document.createDocumentFragment();
          text
            .replace(/\r\n?/g, "\n")
            .split("\n")
            .forEach((line, index) => {
              if (index) fragment.append(document.createElement("br"));
              fragment.append(document.createTextNode(line));
            });
          this.insert(paragraph, fragment);
        },
        options,
      );
      paragraph.addEventListener(
        "keydown",
        (event) => {
          if (event.isComposing || event.keyCode === 229) return;
          if (event.key === "/") this.slashDismissed = false;
          if (this.slash.key(event)) {
            if (["Escape", "Tab"].includes(event.key))
              this.slashDismissed = true;
            return;
          }
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            this.closeSlash();
          const key = event.key.toLowerCase();
          if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(key)) {
            event.preventDefault();
            event.stopPropagation();
            this.pendingFocus = id;
            const siblings = this.state.parent(id)?.children || [];
            const previous =
              siblings[siblings.findIndex((node) => node.id === id) - 1]?.id;
            this.pendingFocusAtStart = false;
            paragraph.blur();
            if (key === "y" || event.shiftKey) this.state.redo();
            else this.state.undo();
            if (!this.state.find(id))
              this.pendingFocus = previous || this.state.initialSelection();
            this.state.selected.set(this.pendingFocus);
            return;
          }
          if (
            event.key !== "Enter" ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          if (event.shiftKey) {
            const fragment = document.createDocumentFragment();
            fragment.append(
              document.createElement("br"),
              document.createTextNode("\u200b"),
            );
            this.insert(paragraph, fragment);
            return;
          }
          this.split(paragraph);
        },
        options,
      );
    }
    if (this.pendingFocus) {
      const target = Array.from(
        document.querySelectorAll<HTMLElement>("[data-inline-text-editor]"),
      ).find(
        (element) => element.dataset["inlineTextEditor"] === this.pendingFocus,
      );
      this.pendingFocus = "";
      if (target) {
        target.focus();
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(this.pendingFocusAtStart);
        document.getSelection()?.removeAllRanges();
        document.getSelection()?.addRange(range);
      }
    }
  }
  private empty(paragraph: HTMLElement) {
    paragraph.dataset["empty"] = String(
      !paragraph.textContent?.replace(/\u200b/g, "").trim(),
    );
  }
  private attachTable(
    block: HTMLElement,
    id: string,
    options: AddEventListenerOptions,
  ) {
    const table = block.querySelector<HTMLTableElement>(".cl-data-table");
    if (!table) return;
    for (const row of Array.from(table.rows)) {
      for (const cell of Array.from(row.cells)) {
        const logicalRow = Number(cell.dataset["tableRow"] ?? row.rowIndex);
        const logicalColumn = Number(
          cell.dataset["tableColumn"] ?? cell.cellIndex,
        );
        if (cell.hasAttribute("data-block-id")) continue;
        cell.contentEditable = "plaintext-only";
        cell.tabIndex = 0;
        cell.dataset["inlineTableEditor"] = id;
        cell.setAttribute(
          "aria-label",
          `Row ${logicalRow + 1}, column ${logicalColumn + 1}`,
        );
        cell.addEventListener(
          "focus",
          () => {
            this.options.focus();
            this.options.select(id);
          },
          options,
        );
        cell.addEventListener(
          "blur",
          () => {
            this.lastInput.id = "";
            const signal = this.events!.signal;
            queueMicrotask(() => {
              if (!signal.aborted && !this.editing) this.options.edited();
            });
          },
          options,
        );
        cell.addEventListener(
          "input",
          () => {
            const node = this.state.find(id);
            if (node?.type !== "core/table") return;
            const data = setTableCellText(
              node.settings["tableData"],
              logicalRow,
              logicalColumn,
              cell.innerText,
            );
            if (
              !data.rows[logicalRow] ||
              logicalColumn >= data.rows[logicalRow].length
            )
              return;
            if (JSON.stringify(data).length > 85000) return;
            const before = JSON.stringify(this.state.document());
            const key = `${id}:${logicalRow}:${logicalColumn}`;
            const group =
              this.lastInput.id === key &&
              this.lastInput.snapshot === before &&
              Date.now() - this.lastInput.at < 1000;
            this.state.commit(() => {
              node.settings["tableData"] = data;
            });
            if (
              group &&
              this.state.past.length > 1 &&
              JSON.stringify(this.state.document()) !== before
            )
              this.state.past.pop();
            this.lastInput = {
              id: key,
              at: Date.now(),
              snapshot: JSON.stringify(this.state.document()),
            };
          },
          options,
        );
        cell.addEventListener(
          "keydown",
          (event) => {
            if (
              (event.ctrlKey || event.metaKey) &&
              ["z", "y"].includes(event.key.toLowerCase())
            ) {
              event.preventDefault();
              event.stopPropagation();
              cell.blur();
              if (event.key.toLowerCase() === "y" || event.shiftKey)
                this.state.redo();
              else this.state.undo();
              this.options.edited();
            }
          },
          options,
        );
      }
    }
    installTableCanvasTools(table, id, this.state, {
      signal: options.signal!,
      select: this.options.select,
      edited: this.options.edited,
      resizing: (active) => {
        this.tableResizing = active;
      },
    });
  }
  private input(paragraph: HTMLElement) {
    const id = paragraph.dataset["inlineTextEditor"]!;
    const before = JSON.stringify(this.state.document());
    const group =
      this.lastInput.id === id &&
      this.lastInput.snapshot === before &&
      Date.now() - this.lastInput.at < 1000;
    this.state.commit(() => {
      const node = this.state.find(id);
      if (node) {
        node.settings["html"] = paragraph.innerHTML.replace(/\u200b/g, "");
        if (node.type === "core/heading")
          node.settings["text"] =
            paragraph.textContent?.replace(/\u200b/g, "") || "";
      }
    });
    if (
      group &&
      this.state.past.length > 1 &&
      JSON.stringify(this.state.document()) !== before
    )
      this.state.past.pop();
    this.lastInput = {
      id,
      at: Date.now(),
      snapshot: JSON.stringify(this.state.document()),
    };
    this.empty(paragraph);
    this.searchSlash(paragraph);
  }
  private closeSlash() {
    this.slash.close();
    this.slashParagraph = undefined;
    this.slashRange = undefined;
  }
  private searchSlash(paragraph: HTMLElement) {
    const id = paragraph.dataset["inlineTextEditor"]!;
    if (this.state.find(id)?.type !== "core/paragraph") return;
    const caret = this.range(paragraph);
    if (!caret.collapsed) {
      this.closeSlash();
      return;
    }
    const prefix = caret.cloneRange();
    prefix.selectNodeContents(paragraph);
    prefix.setEnd(caret.endContainer, caret.endOffset);
    const text = prefix.toString();
    const match = /(?:^|\s)\/([^/\n]*)$/.exec(text);
    if (!match) {
      this.slashDismissed = false;
      this.closeSlash();
      return;
    }
    if (this.slashDismissed) return;
    const start = text.length - match[1].length - 1;
    const walker = paragraph.ownerDocument.createTreeWalker(paragraph, 4);
    let offset = 0,
      current: Node | null;
    while ((current = walker.nextNode())) {
      const length = current.textContent?.length || 0;
      if (start < offset + length) {
        this.slashRange = caret.cloneRange();
        this.slashRange.setStart(current, start - offset);
        break;
      }
      offset += length;
    }
    if (!this.slashRange) return;
    this.slashParagraph = paragraph;
    const parent = this.state.parent(id);
    if (!parent?.children) return;
    const query = match[1].trim().toLowerCase();
    const blocks = this.options
      .blocks()
      .filter(
        (block) =>
          !block.legacy &&
          !block.disabled &&
          (block.label + " " + block.category + " " + block.type)
            .toLowerCase()
            .includes(query) &&
          this.state.canDrop(
            parent.id,
            parent.children!.indexOf(this.state.find(id)!),
            { type: block.type },
          ),
      );
    this.slash.show(paragraph, blocks, query, caret);
  }
  private chooseSlashBlock(type: string) {
    const paragraph = this.slashParagraph,
      range = this.slashRange;
    if (!paragraph || !range) return;
    const id = paragraph.dataset["inlineTextEditor"]!;
    range.deleteContents();
    const html = paragraph.innerHTML.replace(/\u200b/g, "");
    const replace = !paragraph.textContent?.replace(/\u200b/g, "").trim();
    this.closeSlash();
    paragraph.blur();
    const inserted = this.state.insertFromParagraph(id, type, html, replace);
    if (!inserted) {
      this.options.edited();
      return;
    }
    if (["core/paragraph", "core/heading"].includes(type)) {
      this.pendingFocus = inserted;
      this.pendingFocusAtStart = true;
    }
    this.lastInput.id = "";
    this.options.select(inserted);
    this.options.edited();
  }
  private range(paragraph: HTMLElement) {
    const selection = paragraph.ownerDocument.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (range && paragraph.contains(range.commonAncestorContainer))
      return range;
    const end = paragraph.ownerDocument.createRange();
    end.selectNodeContents(paragraph);
    end.collapse(false);
    return end;
  }
  private insert(paragraph: HTMLElement, fragment: DocumentFragment) {
    const range = this.range(paragraph);
    range.deleteContents();
    const last = fragment.lastChild;
    range.insertNode(fragment);
    if (last) range.setStartAfter(last);
    range.collapse(true);
    const selection = paragraph.ownerDocument.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    this.input(paragraph);
  }
  private split(paragraph: HTMLElement) {
    const id = paragraph.dataset["inlineTextEditor"]!;
    const node = this.state.find(id),
      parent = this.state.parent(id);
    if (!node || !parent?.children) return;
    const range = this.range(paragraph);
    range.deleteContents();
    const tail = range.cloneRange();
    tail.setEnd(paragraph, paragraph.childNodes.length);
    const trailing = paragraph.ownerDocument.createElement("div");
    trailing.append(tail.extractContents());
    const next = this.state.create("core/paragraph");
    next.settings = {
      ...structuredClone(
        node.type === "core/heading" ? next.settings : node.settings,
      ),
      html: trailing.innerHTML,
    };
    delete next.settings["anchor"];
    this.pendingFocus = next.id;
    this.pendingFocusAtStart = true;
    paragraph.blur();
    this.state.commit(() => {
      node.settings["html"] = paragraph.innerHTML.replace(/\u200b/g, "");
      if (node.type === "core/heading")
        node.settings["text"] =
          paragraph.textContent?.replace(/\u200b/g, "") || "";
      parent.children!.splice(parent.children!.indexOf(node) + 1, 0, next);
      this.state.selected.set(next.id);
    });
  }
  destroy() {
    this.closeSlash();
    this.events?.abort();
    this.tableResizing = false;
    this.document = undefined;
    this.rootId = "";
    this.pendingFocus = "";
  }
}
