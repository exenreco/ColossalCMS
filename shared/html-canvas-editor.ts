import type { ThemeEditorState } from "./theme-editor-state";
import { canvasBlockId } from "./context-blocks";
import {
  FORMATTED_HTML_TYPE,
  highlightHtml,
  indentHtml,
} from "./formatted-html";

/** A source editor mounted only in authoring canvases; public HTML renders normally. */
export class HtmlCanvasEditor {
  private document?: Document;
  private rootId = "";
  private events?: AbortController;
  private editors = new Map<
    string,
    { sourceId: string; input: HTMLTextAreaElement; paint: () => void }
  >();
  private lastInput = { id: "", at: 0, snapshot: "" };
  constructor(
    private state: ThemeEditorState,
    private options: {
      select: (id: string) => void;
      focus: () => void;
      edited: () => void;
    },
  ) {}
  get editing() {
    const active = this.document?.activeElement as HTMLTextAreaElement | null;
    return (
      !!active?.matches("[data-html-editor]") &&
      this.state.find(active.dataset["htmlEditor"] || "")?.type ===
        FORMATTED_HTML_TYPE
    );
  }
  /** Synchronize Inspector/undo edits without replacing a focused textarea or its caret. */
  syncState() {
    if (!this.document) return;
    if (this.rootId !== this.state.root?.id) {
      for (const { input } of this.editors.values()) input.disabled = true;
      this.destroy();
      return;
    }
    for (const { sourceId, input, paint } of this.editors.values()) {
      const node = this.state.find(sourceId);
      input.disabled = node?.type !== FORMATTED_HTML_TYPE;
      if (input.disabled) continue;
      const source = String(node!.settings["html"] || "");
      if (input.value === source) continue;
      const start = input.selectionStart,
        end = input.selectionEnd;
      input.value = source;
      input.setSelectionRange(
        Math.min(start, source.length),
        Math.min(end, source.length),
      );
      paint();
    }
  }
  attach(document: Document) {
    if (this.document === document && this.rootId === this.state.root?.id) {
      const blocks = Array.from(
        document.querySelectorAll<HTMLElement>("[data-block-id]"),
      ).filter(
        (block) =>
          this.state.find(canvasBlockId(block))?.type === FORMATTED_HTML_TYPE,
      );
      if (
        blocks.length === this.editors.size &&
        blocks.every((block) =>
          block.contains(
            this.editors.get(block.dataset["blockId"]!)?.input || null,
          ),
        )
      ) {
        this.syncState();
        return;
      }
    }
    this.destroy();
    this.events = new AbortController();
    this.document = document;
    this.rootId = this.state.root?.id || "";
    const options = { signal: this.events.signal };
    const style = document.createElement("style");
    document.getElementById("cl-html-editor-styles")?.remove();
    style.id = "cl-html-editor-styles";
    style.textContent = `
      .cl-html-editor{display:block!important;min-width:0!important;max-width:100%!important;background:var(--cl-editor-surface,#202124)!important;color:var(--cl-editor-text,#e3e4e6)!important;border:1px solid var(--cl-editor-border,#393b3e);border-radius:10px;overflow:hidden;text-align:left!important;text-indent:0!important;letter-spacing:normal!important;box-shadow:0 8px 28px #0001}
      .cl-html-editor-header,.cl-html-editor-footer{display:flex!important;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px!important;font:500 12px/1.4 system-ui!important;color:var(--cl-editor-muted,#93979e)!important;background:var(--cl-editor-surface,#202124)!important}
      .cl-html-editor-header{padding-top:36px!important;border-bottom:1px solid var(--cl-editor-border,#393b3e);color:var(--cl-editor-text,#e3e4e6)!important}
      .cl-html-editor-footer{border-top:1px solid var(--cl-editor-border,#393b3e)}
      .cl-html-editor-body{position:relative!important;display:block!important;min-height:160px;overflow:hidden!important;background:var(--cl-editor-bg,#191a1c)!important}
      .cl-html-editor-gutter{position:absolute!important;inset:0 auto 0 0;width:48px;overflow:hidden!important;border-right:1px solid var(--cl-editor-border,#393b3e);background:var(--cl-editor-surface,#202124)!important;pointer-events:none}
      .cl-html-editor-lines,.cl-html-editor-highlight,.cl-html-editor-input{box-sizing:border-box!important;margin:0!important;border:0!important;padding:12px 16px!important;font:400 13px/22px ui-monospace,SFMono-Regular,Consolas,monospace!important;letter-spacing:normal!important;text-align:left!important;text-indent:0!important;text-transform:none!important;white-space:pre!important;tab-size:2!important}
      .cl-html-editor-lines{color:var(--cl-editor-muted,#93979e)!important;text-align:right!important;padding-left:0!important;padding-right:10px!important;background:transparent!important}
      .cl-html-editor-code{position:absolute!important;inset:0 0 0 48px;overflow:hidden!important}
      .cl-html-editor-highlight{position:absolute!important;left:0;top:0;min-width:100%;min-height:100%;color:var(--cl-editor-text,#e3e4e6)!important;background:transparent!important;pointer-events:none}
      .cl-html-editor-input{position:absolute!important;inset:0;width:100%!important;height:100%!important;resize:none!important;overflow:auto!important;outline:none!important;color:transparent!important;-webkit-text-fill-color:transparent!important;caret-color:var(--cl-editor-text,#e3e4e6)!important;background:transparent!important;box-shadow:none!important;opacity:1!important}
      .cl-html-editor-input::selection{background:#4a7c5d66!important}
      .cl-html-editor-input:focus-visible{box-shadow:inset 0 0 0 1px #4a7c5d!important}
      .cl-html-editor-input::placeholder{color:var(--cl-editor-muted,#93979e)!important;-webkit-text-fill-color:var(--cl-editor-muted,#93979e)!important}
      .cl-html-tag{color:var(--cl-editor-code-tag,#95cbb8)!important}.cl-html-attribute{color:var(--cl-editor-code-attribute,#bac3f3)!important}.cl-html-string{color:var(--cl-editor-code-string,#e0bb87)!important}.cl-html-value{color:var(--cl-editor-code-value,#cdade2)!important}.cl-html-comment{color:var(--cl-editor-muted,#93979e)!important}
    `;
    document.head.append(style);
    for (const block of Array.from(
      document.querySelectorAll<HTMLElement>("[data-block-id]"),
    )) {
      const id = canvasBlockId(block);
      const node = this.state.find(id);
      if (node?.type !== FORMATTED_HTML_TYPE) continue;
      const editor = document.createElement("section");
      editor.className = "cl-html-editor";
      editor.setAttribute("aria-label", "Formatted HTML code editor");
      const header = document.createElement("div");
      header.className = "cl-html-editor-header";
      for (const title of ["</>  Formatted HTML", "HTML SOURCE"]) {
        const label = document.createElement("span");
        label.textContent = title;
        header.append(label);
      }
      const body = document.createElement("div");
      body.className = "cl-html-editor-body";
      const gutter = document.createElement("div");
      gutter.className = "cl-html-editor-gutter";
      gutter.setAttribute("aria-hidden", "true");
      const lines = document.createElement("pre");
      lines.className = "cl-html-editor-lines";
      gutter.append(lines);
      const code = document.createElement("div");
      code.className = "cl-html-editor-code";
      const highlight = document.createElement("pre");
      highlight.className = "cl-html-editor-highlight";
      highlight.setAttribute("aria-hidden", "true");
      const input = document.createElement("textarea");
      input.className = "cl-html-editor-input";
      input.dataset["htmlEditor"] = id;
      input.setAttribute("aria-label", "Formatted HTML source");
      input.setAttribute(
        "aria-description",
        "Tab indents, Shift+Tab outdents, Escape exits the code editor. Ctrl or Command+Z undoes.",
      );
      input.spellcheck = false;
      input.wrap = "off";
      input.autocapitalize = "off";
      input.setAttribute("autocomplete", "off");
      input.setAttribute("autocorrect", "off");
      input.placeholder = "<p>Write your content as HTML…</p>";
      input.value = String(node.settings["html"] || "");
      code.append(highlight, input);
      body.append(gutter, code);
      const footer = document.createElement("div");
      footer.className = "cl-html-editor-footer";
      const position = document.createElement("span"),
        hint = document.createElement("span");
      hint.textContent = "Tab to indent · Esc to exit";
      footer.append(position, hint);
      editor.append(header, body, footer);
      // Replace rendered content, keeping only authoring overlays belonging to this block.
      for (const child of Array.from(block.childNodes))
        if (
          child.nodeType !== 1 ||
          !(child as Element).matches(".cl-block-chip,.cl-block-toolbar")
        )
          child.remove();
      block.prepend(editor);
      const scroll = () => {
        highlight.style.transform = `translate(${-input.scrollLeft}px,${-input.scrollTop}px)`;
        lines.style.transform = `translateY(${-input.scrollTop}px)`;
      };
      const cursor = () => {
        const before = input.value.slice(0, input.selectionStart).split("\n");
        position.textContent = `Ln ${before.length}, Col ${before.at(-1)!.length + 1}`;
      };
      const paint = () => {
        const count = input.value.split("\n").length;
        lines.textContent = Array.from({ length: count }, (_, index) =>
          String(index + 1),
        ).join("\n");
        highlight.innerHTML = highlightHtml(input.value) + "\n";
        body.style.height =
          Math.min(420, Math.max(180, count * 22 + 24)) + "px";
        cursor();
        scroll();
      };
      this.editors.set(block.dataset["blockId"]!, {
        sourceId: id,
        input,
        paint,
      });
      paint();
      input.addEventListener(
        "focus",
        () => {
          if (this.state.find(id)?.type !== FORMATTED_HTML_TYPE) return;
          this.options.focus();
          this.options.select(id);
        },
        options,
      );
      input.addEventListener(
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
      input.addEventListener(
        "input",
        () => {
          this.input(id, input);
          paint();
        },
        options,
      );
      input.addEventListener("scroll", scroll, options);
      input.addEventListener("click", cursor, options);
      input.addEventListener("keyup", cursor, options);
      input.addEventListener(
        "keydown",
        (event) => {
          if (event.isComposing || event.keyCode === 229) return;
          const key = event.key.toLowerCase();
          if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(key)) {
            event.preventDefault();
            event.stopPropagation();
            this.lastInput.id = "";
            if (key === "y" || event.shiftKey) this.state.redo();
            else this.state.undo();
            this.syncState();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            block.focus();
            return;
          }
          if (event.ctrlKey || event.metaKey || event.altKey) return;
          if (event.key === "Tab") {
            event.preventDefault();
            event.stopPropagation();
            const edit = indentHtml(
              input.value,
              input.selectionStart,
              input.selectionEnd,
              event.shiftKey,
            );
            input.value = edit.value;
            input.setSelectionRange(edit.start, edit.end);
          } else if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            const line = input.value
              .slice(0, input.selectionStart)
              .split("\n")
              .at(-1)!;
            input.setRangeText(
              "\n" + (line.match(/^\s*/)?.[0] || ""),
              input.selectionStart,
              input.selectionEnd,
              "end",
            );
          } else return;
          this.lastInput.id = "";
          this.input(id, input);
          paint();
        },
        options,
      );
    }
  }
  private input(id: string, input: HTMLTextAreaElement) {
    if (this.state.find(id)?.type !== FORMATTED_HTML_TYPE) return;
    const before = JSON.stringify(this.state.document());
    const group =
      this.lastInput.id === id &&
      this.lastInput.snapshot === before &&
      Date.now() - this.lastInput.at < 1000;
    this.state.commit(() => {
      this.state.find(id)!.settings["html"] = input.value;
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
  }
  destroy() {
    this.events?.abort();
    this.document = undefined;
    this.rootId = "";
    this.editors.clear();
    this.lastInput.id = "";
  }
}
