import {
  Component,
  ElementRef,
  HostListener,
  inject,
  effect,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { ApiService } from "./api.service";
import { ThemeRecord, BlockField } from "./theme-models";
import { ThemeEditorState } from "./theme-editor-state";
import { ThemeBlockTreeComponent } from "./theme-block-tree.component";
import { BlockLibraryDrawerComponent } from "./block-library-drawer.component";
import { BlockListDrawerComponent } from "./block-list-drawer.component";
import { ThemeEditorSecondaryToolbarComponent } from "./theme-editor-secondary-toolbar.component";
import { BlockIconComponent } from "./block-icon.component";
import { ThemeEditorSkeletonComponent } from "./skeleton-compositions";
import { MediaSelectionService } from "./media-selection.service";
import { BlockRegistry } from "./block-registry.service";
import { ContextualBlockToolbarComponent } from "./contextual-block-toolbar.component";
import { hydrateModels } from "./gltf-host";
import { hydrateSliders } from "./swiper-host";
import { themeBodyAttributes } from "./theme-body";
import { modelFieldVisible } from "./model-field-visibility";
import {
  AppearancePickerPanelComponent,
  PICKER_FIELD_KEYS,
} from "./pickers/appearance-picker-panel.component";

@Component({
  selector: "cl-theme-editor",
  standalone: true,
  imports: [
    ContextualBlockToolbarComponent,
    FormsModule,
    ThemeBlockTreeComponent,
    BlockLibraryDrawerComponent,
    BlockListDrawerComponent,
    ThemeEditorSecondaryToolbarComponent,
    BlockIconComponent,
    ThemeEditorSkeletonComponent,
    AppearancePickerPanelComponent,
  ],
  providers: [ThemeEditorState],
  templateUrl: "./theme-editor.component.html",
})
export class ThemeEditorComponent implements OnInit, OnDestroy {
  get maintenance() {
    return this.route.snapshot.pathFromRoot.some(
      (route) => route.data["pluginId"] === "com.colossal.maintenance",
    );
  }
  get apiBase() {
    return this.maintenance ? "/maintenance" : "/themes";
  }
  get editorHome() {
    return this.maintenance ? "/maintenance" : "/themes";
  }
  cdr = inject(ChangeDetectorRef);
  state = inject(ThemeEditorState);
  api = inject(ApiService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  sanitizer = inject(DomSanitizer);
  media = inject(MediaSelectionService);
  registry = inject(BlockRegistry);
  @ViewChild("canvasFrame") canvasFrame?: ElementRef<HTMLIFrameElement>;
  record: ThemeRecord | null = null;
  id = "";
  error = "";
  busy = false;
  mode: "canvas" | "outline" = "canvas";
  width = 1200;
  history = false;
  blockLibraryOpen = false;
  blockListOpen = false;
  inspectorOpen = true;
  showBoundaries = false;
  showBlockToolbar = localStorage.getItem("colossal.block-toolbar") !== "false";
  toolbarHidden = false;
  toolbarPosition = { left: 0, top: 0, width: 600 };
  private toolbarObserver?: ResizeObserver;
  private toolbarEvents?: AbortController;
  private toolbarFrame = 0;
  private scheduleToolbarPosition = () => {
    if (this.toolbarFrame) return;
    this.toolbarFrame = requestAnimationFrame(() => {
      this.toolbarFrame = 0;
      this.positionToolbar();
    });
  };
  toggleBlockToolbar() {
    this.showBlockToolbar = !this.showBlockToolbar;
    localStorage.setItem(
      "colossal.block-toolbar",
      String(this.showBlockToolbar),
    );
    this.positionToolbar();
  }
  dismissToolbar() {
    this.toolbarHidden = true;
    this.renderedBlocks.get(this.state.selected())?.focus();
  }
  positionToolbar = () => {
    const frame = this.canvasFrame?.nativeElement,
      block = this.renderedBlocks.get(this.state.selected());
    if (!frame || !block) return;
    const f = frame.getBoundingClientRect(),
      b = block.getBoundingClientRect();
    const width = Math.min(760, f.width, window.innerWidth - 24);
    const next = {
      width,
      left: Math.max(
        12,
        Math.min(
          f.left + b.left + b.width / 2 - width / 2,
          Math.min(f.right, window.innerWidth - 12) - width,
        ),
      ),
      top: f.top + b.top > 190 ? f.top + b.top - 58 : f.top + b.bottom + 6,
    };
    if (
      Object.keys(next).every(
        (key) => (this.toolbarPosition as any)[key] === (next as any)[key],
      )
    )
      return;
    this.toolbarPosition = next;
    this.cdr.markForCheck();
  };
  dragging = false;
  private refreshPending = false;
  private pointerCleanup?: () => void;
  private renderedBlocks = new Map<string, HTMLElement>();
  canvasHtml: SafeHtml = "";
  recent: string[] = [];
  timer: any;
  sequence = 0;
  destroyed = false;
  enhanced: Document | null = null;
  sizes = [
    { name: "Desktop", width: 1200 },
    { name: "Tablet", width: 768 },
    { name: "Mobile", width: 390 },
  ];
  sides = ["top", "right", "bottom", "left"];
  kinds = ["home", "page", "post", "post-index", "search", "404"];
  constructor() {
    effect(() => {
      this.state.selected();
      this.syncSelection();
    });
    try {
      this.blockLibraryOpen =
        sessionStorage.getItem("colossal.block-library.open") === "true";
      this.inspectorOpen =
        sessionStorage.getItem("colossal.inspector.open") !== "false";
      this.recent = JSON.parse(
        sessionStorage.getItem("colossal.block-recent") || "[]",
      );
    } catch {
      this.recent = [];
    }
  }
  settingLabel(key: string) {
    return (
      (
        {
          color: "Text color",
          background: "Background",
          borderColor: "Border color",
          borderWidth: "Border width",
          radius: "Corner radius",
          maxWidth: "Maximum width",
        } as Record<string, string>
      )[key] || key
    );
  }
  get fields() {
    const all =
      this.state.blocks.find((b) => b.type === this.state.node?.type)?.fields ||
      [];
    return all.filter(
      (f) =>
        modelFieldVisible(
          this.state.node?.type,
          this.state.node?.settings || {},
          f.key,
        ) &&
        !PICKER_FIELD_KEYS.has(f.key) &&
        !(
          f.key === "align" &&
          [
            "core/heading",
            "core/rich-text",
            "core/post-content",
            "core/content",
          ].includes(this.state.node?.type || "")
        ) &&
        !(
          this.state.node?.type === "core/container" &&
          (f.key.startsWith("minHeight") || f.key === "verticalAlign")
        ),
    );
  }
  get partNames() {
    return Object.keys(this.state.document()?.parts || {});
  }
  get currentTemplate() {
    return this.state
      .document()
      ?.manifest.templates.find((t) => t.id === this.state.templateId);
  }
  get templateOptions() {
    return this.state.document()?.manifest.templates || [];
  }
  get blockIcon() {
    return this.state.node === this.state.root && !this.state.part
      ? "fas fa-file-code"
      : this.state.node
        ? this.state.iconFor(this.state.node.type)
        : "";
  }
  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get("id")!;
    this.state.onDragStart = () => {
      this.dragging = true;
      this.cdr.markForCheck();
    };
    this.state.onDragEnd = () => this.dragEnded();
    this.state.onPointerStart = (event, source) =>
      this.pointerDragStart(event, source);
    this.state.onChange = () => {
      this.sequence++;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.refreshCanvas(), 350);
    };
    this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.pointerCleanup?.();
    this.toolbarObserver?.disconnect();
    this.toolbarEvents?.abort();
    cancelAnimationFrame(this.toolbarFrame);
    clearTimeout(this.timer);
  }
  async load(preserveSelection = false) {
    try {
      const part = preserveSelection ? this.state.part : "";
      const selectedId = preserveSelection ? this.state.selected() : "";
      this.record = await this.api.request(this.apiBase + "/" + this.id);
      const d = structuredClone(this.record!.draft || this.record!.published);
      const active = new Set(
        this.api
          .state()
          ?.plugins.filter((p) => p.active)
          .map((p) => p.id),
      );
      for (const b of this.registry
        .definitions()
        .filter((b) => b.pluginId && active.has(b.pluginId)))
        if (!d.blocks.some((x) => x.type === b.type)) d.blocks.push(b);
      if (!preserveSelection) this.state.templateId = "home";
      this.state.load(d);
      if (part && d.parts[part]) {
        this.state.part = part;
        this.state.selected.set(
          this.state.find(selectedId)?.id || this.state.root!.id,
        );
      } else if (preserveSelection && this.state.find(selectedId)) {
        this.state.selected.set(selectedId);
      }
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.cdr.markForCheck();
    }
  }
  async run(fn: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    try {
      await fn();
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
  async saveDraft() {
    const snapshot = JSON.stringify(this.state.document());
    const result = await this.api.request(
      this.apiBase + "/" + this.id + "/draft",
      "PUT",
      { revision: this.record!.revision, document: this.state.document() },
    );
    this.record!.revision = result.revision;
    this.record!.hasDraft = true;
    this.state.saved = snapshot;
  }
  async save() {
    await this.run(async () => {
      await this.saveDraft();
      this.api.toast(
        this.maintenance ? "Maintenance draft saved." : "Theme draft saved.",
      );
    });
  }
  async publish() {
    const document = this.state.document()!;
    const contains = (node: any, type: string): boolean =>
      node.type === type ||
      (node.children || []).some((c: any) => contains(c, type));
    const warnings = document.manifest.templates
      .filter(
        (t) =>
          t.appliesTo.some((k) => ["page", "post"].includes(k)) &&
          !contains(document.templates[t.id], "theme/part-content"),
      )
      .map(
        (t) =>
          `The template '${t.name}' doesn't include the Content part. Check that its body is rendered by another block.`,
      );
    const original = this.record?.draft || this.record?.published;
    for (const [name, tree] of Object.entries(document.parts)) {
      if (JSON.stringify(tree) !== JSON.stringify(original?.parts[name])) {
        const count = Object.values(document.templates).filter((t) =>
          contains(t, "theme/part-" + name),
        ).length;
        warnings.push(`Editing the ${name} part affects ${count} templates.`);
      }
    }
    if (
      !this.maintenance &&
      warnings.length &&
      !confirm(warnings.join("\n") + "\nPublish anyway?")
    )
      return;
    await this.run(async () => {
      if (this.state.dirty || !this.record!.hasDraft) await this.saveDraft();
      await this.api.request(
        this.apiBase + "/" + this.id + "/publish",
        "POST",
        {
          revision: this.record!.revision,
        },
      );
      await this.load(true);
      await this.api.load();
      this.api.toast(
        this.maintenance ? "Maintenance layout published." : "Theme published.",
      );
    });
  }
  async refreshCanvas() {
    if (!this.state.document() || this.destroyed) return;
    if (this.dragging) {
      this.refreshPending = true;
      return;
    }
    this.refreshPending = false;
    const seq = ++this.sequence;
    try {
      const r = await this.api.request(
        this.apiBase + "/" + this.id + "/render",
        "POST",
        {
          document: this.state.document(),
          templateId: this.state.templateId,
          part: this.state.part,
        },
      );
      if (seq !== this.sequence || this.destroyed) return;
      if (this.dragging) {
        this.refreshPending = true;
        return;
      }
      this.canvasHtml = this.sanitizer.bypassSecurityTrustHtml(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}html,body{min-height:100%}' +
          r.css +
          "</style></head><body " +
          themeBodyAttributes(r.body) +
          ">" +
          r.html +
          "</body></html>",
      );
    } catch (e) {
      if (seq === this.sequence) this.error = (e as Error).message;
    } finally {
      this.cdr.markForCheck();
    }
  }
  /** True-frontend canvas: same render as the Frontend, plus additive affordances. */
  enhanceCanvas() {
    const doc = this.canvasFrame?.nativeElement?.contentDocument;
    if (!doc?.querySelector(".theme-root")) return;
    if (this.enhanced === doc) {
      this.syncSelection();
      return;
    }
    this.enhanced = doc;
    hydrateModels(doc);
    hydrateSliders(doc, true);
    this.toolbarObserver?.disconnect();
    this.toolbarEvents?.abort();
    this.toolbarEvents = new AbortController();
    const options = { capture: true, signal: this.toolbarEvents.signal };
    document.addEventListener("scroll", this.scheduleToolbarPosition, options);
    doc.addEventListener("scroll", this.scheduleToolbarPosition, options);
    this.toolbarObserver = new ResizeObserver(this.scheduleToolbarPosition);
    this.toolbarObserver.observe(this.canvasFrame!.nativeElement);
    this.renderedBlocks = new Map(
      Array.from(doc.querySelectorAll<HTMLElement>("[data-block-id]")).map(
        (el) => [el.dataset["blockId"]!, el],
      ),
    );
    for (const [id, element] of this.renderedBlocks)
      if (this.state.find(id)) element.tabIndex = 0;
    const style = doc.createElement("style");
    style.textContent = `
      .theme-root [data-block-id]{position:relative}
      .theme-root [data-block-id].cl-overlay-block{pointer-events:auto}
      .theme-root [data-block-id].cl-block-hover::after,
      .theme-root [data-block-id].cl-block-selected::after,
      .theme-root [data-block-id].cl-drop-before::before,
      .theme-root [data-block-id].cl-drop-after::before{content:"";position:absolute;pointer-events:none;box-sizing:border-box}
      .theme-root [data-block-id].cl-block-hover::after{inset:0;outline:1px solid #4a7c5d}
      .theme-root [data-block-id].cl-block-selected::after{inset:0;outline:2px solid #2f6b4f}
      .theme-root [data-block-id]:focus-visible{outline:3px solid #2f6b4f;outline-offset:2px}
      .theme-root [data-block-id].cl-drop-before::before{left:0;right:0;top:-2px;height:3px;background:#2f6b4f}
      .theme-root [data-block-id].cl-drop-after::before{left:0;right:0;bottom:-2px;height:3px;background:#2f6b4f}
      .cl-block-chip{position:absolute;top:4px;left:4px;z-index:9;background:#14392f;color:#fff;font:600 11px/1 system-ui;padding:4px 7px;border-radius:4px;pointer-events:none;text-transform:capitalize}
      .cl-block-toolbar{position:absolute;top:4px;right:4px;z-index:10;display:flex;gap:4px;background:#fff;border:1px solid #cbd6c6;border-radius:6px;padding:3px;box-shadow:0 2px 8px #0002}
      .cl-block-toolbar button{font:600 11px system-ui;border:0;background:none;cursor:pointer;color:#2f6b4f;padding:2px 5px}
    `;
    style.textContent += `.cl-show-boundaries [data-block-id]{box-shadow:inset 0 0 0 1px #47725444;background-image:linear-gradient(#47725408,#47725408)}`;
    doc.head.appendChild(style);
    doc.body.classList.toggle("cl-show-boundaries", this.showBoundaries);
    doc.addEventListener("keydown", (e) => {
      const block = (e.target as HTMLElement)?.closest?.(
        "[data-block-id]",
      ) as HTMLElement | null;
      if (
        block &&
        !(e.target as HTMLElement)?.closest?.(
          "input,textarea,select,[contenteditable]",
        )
      ) {
        const id = block.dataset["blockId"]!;
        if (e.key === "Enter") {
          e.preventDefault();
          this.state.selected.set(id);
          this.setInspector(true);
        } else if (e.altKey && ["ArrowUp", "ArrowDown"].includes(e.key)) {
          e.preventDefault();
          this.state.selected.set(id);
          this.state.shift(e.key === "ArrowUp" ? -1 : 1);
        } else if (
          e.key === "Delete" &&
          !this.state.protected(this.state.find(id)!)
        ) {
          e.preventDefault();
          this.state.selected.set(id);
          this.state.remove();
        }
      }
      this.keyboard(e);
    });
    const clear = (cls: string) =>
      doc.querySelectorAll("." + cls).forEach((el) => el.classList.remove(cls));
    doc.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement)?.closest?.("[data-block-id]");
      e.preventDefault();
      if (this.blockLibraryOpen) {
        this.setBlockLibrary(false);
        this.state.selected.set("");
      } else if (el) {
        this.state.selected.set(el.getAttribute("data-block-id")!);
        this.setInspector(true);
      }
      this.cdr.markForCheck();
    });
    doc.addEventListener("mouseover", (e) => {
      clear("cl-block-hover");
      const el = (e.target as HTMLElement)?.closest?.("[data-block-id]");
      if (el) el.classList.add("cl-block-hover");
    });
    doc.addEventListener("mouseout", () => clear("cl-block-hover"));
    // One non-interactive overlay leaves target geometry unchanged throughout the drag.
    const indicator = doc.createElement("div");
    indicator.className = "cl-drop-indicator";
    indicator.hidden = true;
    indicator.style.cssText =
      "position:fixed;pointer-events:none;z-index:2147483647;box-sizing:border-box;border:2px solid #2f6b4f;background:#2f6b4f;";
    doc.body.appendChild(indicator);
    doc.addEventListener("dragover", (e) => {
      const target = this.resolveDropTarget(doc, e.clientX, e.clientY);
      indicator.hidden = !target;
      if (!target) {
        if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
        return;
      }
      e.preventDefault();
      if (e.dataTransfer)
        e.dataTransfer.dropEffect = this.state.dragSource?.id ? "move" : "copy";
      Object.assign(indicator.style, {
        left: target.left + "px",
        top: target.top + "px",
        width: target.width + "px",
        height: target.height + "px",
        background: target.height > 4 ? "#2f6b4f12" : "#2f6b4f",
      });
      indicator.dataset["parentId"] = target.parentId;
      indicator.dataset["index"] = String(target.index);
    });
    doc.addEventListener("dragleave", (e) => {
      if (!e.relatedTarget) indicator.hidden = true;
    });
    doc.addEventListener("dragend", () => this.dragEnded());
    doc.addEventListener("drop", (e) => {
      e.preventDefault();
      indicator.hidden = true;
      let source;
      try {
        source = JSON.parse(
          e.dataTransfer?.getData("application/x-colossal-block") || "{}",
        );
      } catch {
        this.dragEnded();
        return;
      }
      this.state.dragSource = source;
      const target = this.resolveDropTarget(doc, e.clientX, e.clientY);
      if (target) {
        if (source.id)
          this.state.dropBlock(target.parentId, target.index, source);
        else this.insertBlock(source.type, target.parentId, target.index);
      }
      this.dragEnded();
      this.cdr.markForCheck();
    });
    this.syncSelection();
  }
  resolveDropTarget(doc: Document, x: number, y: number) {
    let el = (
      doc.elementFromPoint(x, y) as HTMLElement | null
    )?.closest<HTMLElement>("[data-block-id]");
    // Shared parts render their own trees. Walk up to the editable template boundary.
    while (el && !this.state.find(el.dataset["blockId"] || ""))
      el = el.parentElement?.closest<HTMLElement>("[data-block-id]");
    if (!el) return null;
    const node = this.state.find(el.dataset["blockId"]!)!;
    let parent = node,
      index = 0;
    const rendered = (id: string) => this.renderedBlocks.get(id);
    if (node.children) {
      index = node.children.length;
      const horizontal = node.type === "core/columns";
      for (let i = 0; i < node.children.length; i++) {
        const child = rendered(node.children[i].id);
        if (!child) continue;
        const rect = child.getBoundingClientRect();
        if (
          horizontal
            ? y < rect.top ||
              (y <= rect.bottom && x < rect.left + rect.width / 2)
            : y < rect.top + rect.height / 2
        ) {
          index = i;
          break;
        }
      }
    } else {
      const p = this.state.parent(node.id);
      if (!p) return null;
      parent = p;
      const rect = el.getBoundingClientRect(),
        horizontal = parent.type === "core/columns";
      index =
        parent.children!.indexOf(node) +
        ((
          horizontal
            ? x >= rect.left + rect.width / 2
            : y >= rect.top + rect.height / 2
        )
          ? 1
          : 0);
    }
    if (!this.state.canDrop(parent.id, index)) return null;
    const before = parent.children![index],
      after = parent.children![index - 1];
    const beforeEl = before && rendered(before.id),
      afterEl = after && rendered(after.id);
    const anchor = beforeEl || afterEl || rendered(parent.id)!;
    if (!anchor) return null;
    const rect = anchor.getBoundingClientRect(),
      horizontal = parent.type === "core/columns";
    const empty = !beforeEl && !afterEl;
    return {
      parentId: parent.id,
      index,
      left: empty
        ? rect.left + 4
        : horizontal
          ? (beforeEl ? rect.left : rect.right) - 2
          : rect.left,
      top: empty
        ? rect.top + 4
        : horizontal
          ? rect.top
          : (beforeEl ? rect.top : rect.bottom) - 2,
      width: empty ? Math.max(8, rect.width - 8) : horizontal ? 4 : rect.width,
      height: empty
        ? Math.max(12, rect.height - 8)
        : horizontal
          ? rect.height
          : 4,
    };
  }
  syncSelection() {
    this.toolbarHidden = false;
    this.positionToolbar();
    const doc = this.enhanced;
    if (!doc) return;
    const selected = this.state.selected();
    const node = this.state.find(selected);
    doc.querySelectorAll("[data-block-id]").forEach((el) => {
      const isSelected = el.getAttribute("data-block-id") === selected;
      el.classList.toggle("cl-block-selected", isSelected);
      const chip = el.querySelector(":scope > .cl-block-chip");
      const toolbar = el.querySelector(":scope > .cl-block-toolbar");
      if (isSelected && node && !this.state.protected(node)) {
        if (!chip) {
          const span = doc.createElement("span");
          span.className = "cl-block-chip";
          span.textContent = this.state.label(node);
          el.appendChild(span);
        }
        if (!toolbar) el.appendChild(this.buildToolbar(doc, selected));
      } else {
        chip?.remove();
        toolbar?.remove();
      }
    });
  }
  buildToolbar(doc: Document, id: string) {
    const bar = doc.createElement("span");
    bar.className = "cl-block-toolbar";
    const make = (label: string, fn: () => void) => {
      const b = doc.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.state.selected.set(id);
        fn();
      });
      return b;
    };
    bar.append(make("⠿", () => {}));
    const handle = bar.firstElementChild as HTMLButtonElement;
    handle.draggable = true;
    handle.setAttribute("aria-label", "Move block");
    handle.style.cursor = "grab";
    handle.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      this.state.dragSource = { id };
      this.dragging = true;
      e.dataTransfer?.setData(
        "application/x-colossal-block",
        JSON.stringify({ id }),
      );
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      this.cdr.markForCheck();
    });
    handle.addEventListener("dragend", () => this.dragEnded());
    return bar;
  }
  insertBlock(type: string, parentId?: string, index?: number) {
    this.state.insert(type, parentId, index);
    this.recent = [type, ...this.recent.filter((t) => t !== type)].slice(0, 5);
    sessionStorage.setItem(
      "colossal.block-recent",
      JSON.stringify(this.recent),
    );
  }
  selectTemplate(id: string) {
    this.state.templateId = id;
    this.state.part = "";
    this.state.selected.set(this.state.root!.id);
    this.state.onChange();
  }
  selectPart(name: string) {
    this.state.part = name;
    this.state.selected.set(this.state.root!.id);
    this.state.onChange();
  }
  toggleBlockLibrary() {
    this.setBlockLibrary(!this.blockLibraryOpen, true);
  }
  toggleBlockList() {
    this.setBlockList(!this.blockListOpen, true);
  }
  setBlockList(open: boolean, focus = false) {
    this.blockListOpen = open;
    if (open) this.setBlockLibrary(false);
    if (open && window.innerWidth < 1200) this.setInspector(false);
    this.cdr.markForCheck();
    if (focus)
      setTimeout(() =>
        document
          .querySelector<HTMLElement>(
            open ? ".block-list-tree .theme-node-label" : ".block-list-trigger",
          )
          ?.focus(),
      );
  }
  /** Drawer state survives navigation; desktop layout pushes, small screens overlay. */
  setBlockLibrary(open: boolean, focus = false) {
    this.blockLibraryOpen = open;
    if (open) this.blockListOpen = false;
    sessionStorage.setItem("colossal.block-library.open", String(open));
    if (open && window.innerWidth < 1200) this.setInspector(false);
    this.cdr.markForCheck();
    if (focus)
      setTimeout(() => {
        document
          .querySelector<HTMLElement>(
            open ? ".block-library__search" : ".blocks-trigger",
          )
          ?.focus();
      });
  }
  setInspector(open: boolean) {
    this.inspectorOpen = open;
    sessionStorage.setItem("colossal.inspector.open", String(open));
    if (
      open &&
      window.innerWidth < 1200 &&
      (this.blockLibraryOpen || this.blockListOpen)
    ) {
      this.setBlockLibrary(false);
      this.setBlockList(false);
    }
    this.cdr.markForCheck();
  }
  toggleInspector() {
    this.setInspector(!this.inspectorOpen);
  }
  closeDrawers() {
    this.setBlockLibrary(false, true);
    this.setBlockList(false);
    this.setInspector(false);
  }
  canvasClick(event: MouseEvent) {
    const blockLabel = (event.target as HTMLElement).closest(
      ".theme-node-label",
    );
    if (this.blockLibraryOpen || this.blockListOpen) {
      this.setBlockLibrary(false);
      this.setBlockList(false);
      if (!blockLabel) this.state.selected.set("");
    }
    if (blockLabel) this.setInspector(true);
  }
  toggleBoundaries() {
    this.showBoundaries = !this.showBoundaries;
    this.enhanced?.body.classList.toggle(
      "cl-show-boundaries",
      this.showBoundaries,
    );
  }
  /** Capture one pointer across the iframe; native OS dragging can block the embedded browser. */
  libraryPointerStart({ event, type }: { event: PointerEvent; type: string }) {
    this.pointerDragStart(event, { type });
  }
  pointerDragStart(event: PointerEvent, block: { id?: string; type?: string }) {
    if (event.button !== 0 || this.busy) return;
    this.pointerCleanup?.();
    const source =
      (event.target as HTMLElement).closest<HTMLElement>(".theme-node-label") ||
      (event.currentTarget as HTMLElement);
    const owner = source.ownerDocument;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    let active = false;
    let outline: HTMLElement | null = null;
    let outlineSide = "";
    let target: ReturnType<ThemeEditorComponent["resolveDropTarget"]> = null;
    const transfer = new DataTransfer();
    transfer.setData("application/x-colossal-block", JSON.stringify(block));
    const suppressClick = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const clearOutline = () => {
      if (outline)
        outline.dispatchEvent(new DragEvent("dragleave", { bubbles: true }));
      outline = null;
      outlineSide = "";
    };
    const hide = () => {
      this.enhanced
        ?.querySelector(".cl-drop-indicator")
        ?.setAttribute("hidden", "");
      clearOutline();
      target = null;
    };
    this.pointerCleanup = () => {
      this.pointerCleanup = undefined;
      controller.abort();
      if (source.hasPointerCapture(event.pointerId))
        source.releasePointerCapture(event.pointerId);
      hide();
      if (active)
        setTimeout(
          () => source.removeEventListener("click", suppressClick, true),
          250,
        );
    };
    const locate = (e: PointerEvent) => {
      const hit = owner.elementFromPoint(
        e.clientX,
        e.clientY,
      ) as HTMLElement | null;
      const frame = this.canvasFrame?.nativeElement;
      if (frame && hit === frame && frame.contentDocument === this.enhanced) {
        clearOutline();
        const rect = frame.getBoundingClientRect();
        target = this.resolveDropTarget(
          this.enhanced!,
          e.clientX - rect.left - frame.clientLeft,
          e.clientY - rect.top - frame.clientTop,
        );
        const indicator =
          this.enhanced!.querySelector<HTMLElement>(".cl-drop-indicator");
        if (indicator) {
          indicator.hidden = !target;
        }
        if (target && indicator) {
          Object.assign(indicator.style, {
            left: target.left + "px",
            top: target.top + "px",
            width: target.width + "px",
            height: target.height + "px",
          });
        }
      } else {
        target = null;
        this.enhanced
          ?.querySelector(".cl-drop-indicator")
          ?.setAttribute("hidden", "");
        const nextOutline =
          hit?.closest<HTMLElement>(".theme-drop-zone,.theme-tree-row") || null;
        const changed = outline !== nextOutline;
        if (changed) {
          clearOutline();
          outline = nextOutline;
        }
        if (outline) {
          const rect = outline.getBoundingClientRect();
          const side = outline.matches(".theme-tree-row")
            ? e.clientY < rect.top + rect.height / 2
              ? "before"
              : "after"
            : "zone";
          if (changed || side !== outlineSide) {
            outlineSide = side;
            outline.dispatchEvent(
              new DragEvent("dragover", {
                bubbles: true,
                cancelable: true,
                dataTransfer: transfer,
                clientX: e.clientX,
                clientY: e.clientY,
              }),
            );
          }
        }
      }
    };
    owner.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerId !== event.pointerId) return;
        if (!active) {
          if (
            Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < 5
          )
            return;
          active = true;
          source.addEventListener("click", suppressClick, true);
          this.state.dragSource = block;
          this.dragging = true;
          this.cdr.detectChanges(); // Make the responsive scrim non-interactive before hit testing.
          try {
            source.setPointerCapture(event.pointerId);
          } catch {
            /* Synthetic pointers need no capture. */
          }
        }
        e.preventDefault();
        locate(e);
      },
      options,
    );
    owner.addEventListener(
      "pointerup",
      (e) => {
        if (e.pointerId !== event.pointerId) return;
        if (active) {
          e.preventDefault();
          locate(e);
          if (target) {
            if (block.id)
              this.state.dropBlock(target.parentId, target.index, block);
            else if (block.type)
              this.insertBlock(block.type, target.parentId, target.index);
          } else
            outline?.dispatchEvent(
              new DragEvent("drop", {
                bubbles: true,
                cancelable: true,
                dataTransfer: transfer,
                clientX: e.clientX,
                clientY: e.clientY,
              }),
            );
        }
        this.dragEnded();
      },
      options,
    );
    owner.addEventListener("pointercancel", () => this.dragEnded(), options);
    source.addEventListener(
      "lostpointercapture",
      () => this.dragEnded(),
      options,
    );
    owner.defaultView?.addEventListener(
      "blur",
      () => this.dragEnded(),
      options,
    );
    try {
      source.setPointerCapture(event.pointerId);
    } catch {
      /* Synthetic pointers need no capture. */
    }
  }
  libraryDrag(event: DragEvent) {
    try {
      this.state.dragSource = JSON.parse(
        event.dataTransfer?.getData("application/x-colossal-block") || "{}",
      );
    } catch {
      this.state.dragSource = null;
    }
    this.dragging = true;
  }
  async chooseMedia(f: BlockField) {
    const id = this.state.selected();
    const items = await this.media.open({
      accept:
        f.type === "model"
          ? ["model"]
          : f.type === "image"
            ? ["image"]
            : ["image", "video", "audio"],
      initialSelectionIds: [this.state.node?.settings[f.key]].filter(Boolean),
    });
    if (items[0]) {
      this.state.selected.set(id);
      this.state.set(f.key, items[0].id);
    }
  }
  replaceBlockMedia(type: string) {
    const portrait =
      this.state.node?.type === "core/gltf" &&
      this.state.node.settings["source"] === "portrait";
    this.chooseMedia({
      key: portrait ? "portraitImage" : "mediaId",
      label: "Media file",
      type,
    });
  }
  /** Inline selections are stored in the block HTML; no selection formats the entire block. */
  formatText(key: string) {
    const node = this.state.node;
    if (!node) return;
    const block = this.renderedBlocks.get(node.id),
      doc = this.enhanced;
    const selection = doc?.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const selected =
      range &&
      !range.collapsed &&
      block?.contains(range.commonAncestorContainer) &&
      ["core/heading", "core/rich-text"].includes(node.type);
    if (!selected) {
      this.state.set(key, !node.settings[key]);
      return;
    }
    const tag = (
      {
        bold: "strong",
        italic: "em",
        underline: "u",
        strike: "s",
        inlineCode: "code",
        link: "a",
      } as Record<string, string>
    )[key];
    if (!tag) return;
    const wrapper = doc!.createElement(tag);
    if (key === "link") {
      const href = prompt("Link URL (HTTPS, mailto, or local path):");
      if (
        !href ||
        !/^(https:\/\/|mailto:|\/(?!\/))/.test(href) ||
        /[\x00-\x20]/.test(href)
      )
        return;
      wrapper.setAttribute("href", href);
      wrapper.setAttribute("rel", "noopener noreferrer");
    }
    wrapper.appendChild(range!.extractContents());
    range!.insertNode(wrapper);
    selection!.removeAllRanges();
    const content =
      node.type === "core/heading"
        ? block!.querySelector("h1,h2,h3,h4,h5,h6")
        : block;
    if (!content) return;
    const clone = content.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll(".cl-block-chip,.cl-block-toolbar")
      .forEach((el) => el.remove());
    this.state.set("html", clone.innerHTML);
  }
  setBreakpoint(bp: string, value: any) {
    const current = this.state.node?.settings["minHeightByBreakpoint"] || {};
    this.state.set("minHeightByBreakpoint", {
      ...current,
      [bp]: value === "" || value === null ? null : Number(value),
    });
  }
  breakpointValue(bp: string) {
    const v = this.state.node?.settings["minHeightByBreakpoint"]?.[bp];
    return v === undefined || v === null ? "" : v;
  }
  async previewSite() {
    await this.run(async () => {
      if (this.state.dirty) await this.saveDraft();
      const r = await this.api.request(
        this.apiBase + "/" + this.id + "/preview",
        "POST",
        this.maintenance ? { templateId: this.state.templateId } : {},
      );
      window.open(r.url, "_blank", "noopener");
    });
  }
  async exportTheme() {
    await this.run(async () => {
      if (this.state.dirty) await this.saveDraft();
      const a = document.createElement("a");
      a.href = "/api/themes/" + this.id + "/export";
      a.download = this.id + ".zip";
      a.click();
    });
  }
  async clone() {
    const name = prompt(
      this.maintenance ? "Name the new layout" : "Name the new theme",
      this.record!.name + " copy",
    );
    if (!name) return;
    await this.run(async () => {
      if (this.state.dirty) await this.saveDraft();
      const r = await this.api.request(
        this.apiBase + "/" + this.id + "/clone",
        "POST",
        { name, revision: this.record!.revision },
      );
      this.state.saved = JSON.stringify(this.state.document());
      await this.router.navigateByUrl(this.editorHome);
      await this.router.navigate([this.editorHome + "/edit", r.id]);
    });
  }
  async revert() {
    if (!confirm("Discard this draft and return to the published theme?"))
      return;
    await this.run(async () => {
      await this.api.request(this.apiBase + "/" + this.id + "/revert", "POST", {
        revision: this.record!.revision,
      });
      await this.load();
    });
  }
  async restore(historyId: string) {
    if (!confirm("Replace the current draft with this earlier version?"))
      return;
    await this.run(async () => {
      await this.api.request(
        this.apiBase + "/" + this.id + "/restore",
        "POST",
        {
          revision: this.record!.revision,
          historyId,
        },
      );
      await this.load();
      this.api.toast(
        "Earlier version restored as a draft. Publish to make it live.",
      );
    });
  }
  updateTemplate(key: string, value: any) {
    this.state.commit(() => {
      (this.currentTemplate as any)[key] = value;
    });
  }
  setLandingTemplate(id: string) {
    this.state.commit(() => {
      const manifest = this.state.document()!.manifest;
      if (id) manifest.homeTemplate = id;
      else delete manifest.homeTemplate;
    });
  }
  setDefault(on: boolean) {
    if (!on) return;
    this.state.commit(() => {
      for (const t of this.state.document()!.manifest.templates)
        t.isDefault = t.id === this.state.templateId;
    });
  }
  typeDefault(on: boolean) {
    this.state.commit(() => {
      const current = this.currentTemplate!;
      for (const t of this.state.document()!.manifest.templates)
        if (
          t.id !== current.id &&
          t.appliesTo.some((k) => current.appliesTo.includes(k))
        )
          t.isTypeDefault = false;
      current.isTypeDefault = on;
    });
  }
  toggleKind(kind: string, on: boolean) {
    if (!on && this.currentTemplate!.appliesTo.length === 1) return;
    this.state.commit(() => {
      const t = this.currentTemplate!;
      t.appliesTo = on
        ? [...t.appliesTo, kind]
        : t.appliesTo.filter((x) => x !== kind);
      t.isTypeDefault = false;
      if (
        kind === "home" &&
        !on &&
        this.state.document()!.manifest.homeTemplate === t.id
      )
        delete this.state.document()!.manifest.homeTemplate;
    });
  }
  newTemplate() {
    const name = prompt(
      "Template name",
      this.maintenance ? "New maintenance template" : "New page template",
    );
    if (!name) return;
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!/^[a-z]/.test(id) || this.state.document()!.templates[id]) {
      this.error = "Use a unique template name starting with a letter.";
      return;
    }
    this.state.commit(() => {
      const d = this.state.document()!;
      d.templates[id] = this.state.copyTree(d.templates[this.state.templateId]);
      d.manifest.templates.push({
        id,
        name,
        file: "templates/" + id + ".html",
        appliesTo: [this.maintenance ? "home" : "page"],
      });
    });
    this.selectTemplate(id);
  }
  canLeave() {
    return (
      !this.state.dirty ||
      confirm("Leave the editor and discard unsaved changes?")
    );
  }
  close() {
    this.router.navigateByUrl(this.editorHome);
  }
  @HostListener("window:dragend")
  @HostListener("window:drop")
  dragEnded() {
    this.pointerCleanup?.();
    this.dragging = false;
    this.state.dragSource = null;
    if (this.refreshPending && !this.destroyed) {
      this.refreshPending = false;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.refreshCanvas(), 0);
    }
    this.enhanced
      ?.querySelector(".cl-drop-indicator")
      ?.setAttribute("hidden", "");
    this.cdr.markForCheck();
  }
  @HostListener("window:beforeunload", ["$event"]) beforeUnload(
    e: BeforeUnloadEvent,
  ) {
    if (this.state.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  }
  @HostListener("window:keydown", ["$event"]) keyboard(e: KeyboardEvent) {
    if (e.altKey && e.key === "F10") {
      e.preventDefault();
      this.showBlockToolbar = true;
      this.toolbarHidden = false;
      this.cdr.detectChanges();
      document
        .querySelector<HTMLElement>(".contextual-block-toolbar button")
        ?.focus();
      return;
    }
    if (e.key === "Escape") {
      if (this.dragging) {
        e.preventDefault();
        this.dragEnded();
        return;
      }
      if (this.blockLibraryOpen) this.setBlockLibrary(false, true);
      else if (this.blockListOpen) this.setBlockList(false, true);
      else if (this.inspectorOpen) this.setInspector(false);
      document
        .querySelectorAll(".theme-more[open]")
        .forEach((el) => el.removeAttribute("open"));
      return;
    }
    if (this.busy) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === "s") {
      e.preventDefault();
      this.save();
      return;
    }
    if (
      (e.target as HTMLElement)?.closest(
        "input,textarea,select,[contenteditable]",
      )
    )
      return;
    const key = e.key.toLowerCase();
    if (
      ["i", "u", "k"].includes(key) &&
      this.state.node &&
      ["core/heading", "core/rich-text"].includes(this.state.node.type)
    ) {
      e.preventDefault();
      this.formatText({ i: "italic", u: "underline", k: "link" }[key]!);
      return;
    }
    if (
      key === "b" &&
      this.enhanced?.getSelection()?.toString() &&
      this.state.node &&
      ["core/heading", "core/rich-text"].includes(this.state.node.type)
    ) {
      e.preventDefault();
      this.formatText("bold");
      return;
    }
    if (["1", "2", "3"].includes(key)) {
      e.preventDefault();
      this.width = this.sizes[Number(key) - 1].width;
      this.cdr.markForCheck();
      return;
    }
    if (key === "b") {
      e.preventDefault();
      this.toggleBlockLibrary();
      return;
    }
    if (e.shiftKey && (key === "o" || key === "c")) {
      e.preventDefault();
      this.mode = key === "o" ? "outline" : "canvas";
      this.cdr.markForCheck();
      return;
    }
    if (["z", "y", "c", "v"].includes(key)) e.preventDefault();
    if (key === "z") e.shiftKey ? this.state.redo() : this.state.undo();
    if (key === "y") this.state.redo();
    if (key === "c") this.state.copy();
    if (key === "v") this.state.paste();
  }
}
