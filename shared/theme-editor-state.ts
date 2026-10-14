import { MAX_BLOCK_DEPTH } from "./block-limits";
import { BlockPattern, clonePatternBlocks } from "./block-patterns";
import { applyOutlineCommand } from "./outline-document";
import { ApiService } from "./api.service";
import { Injectable, signal, inject } from "@angular/core";
import { BlockDefinition, BlockNode, ThemeDocument } from "./theme-models";
import definitions from "./theme-blocks.json";
import { normalizeDocumentColumns } from "./theme-layout";
import { normalizeFormattedHtmlNames } from "./formatted-html";
import {
  sharedPartDefinitions,
  sharedPartName,
  sharedPartPlacementError,
  sharedPartsError,
} from "./shared-part-blocks";
import {
  canPlacePagination,
  normalizeContextDocument,
  normalizeMenuDocument,
  paginationPlacementValid,
  postListChildren,
} from "./context-blocks";

/** A bounded undo journal shared by the outline, drop targets and inspector. */
@Injectable()
export class ThemeEditorState {
  private api = inject(ApiService);
  document = signal<ThemeDocument | null>(null);
  selected = signal("");
  dragSource: { id?: string; type?: string } | null = null;
  /** Use the block tree, rather than rendered DOM wrappers, to validate a destination. */
  canDrop(parentId: string, index: number, source = this.dragSource) {
    const parent = this.find(parentId);
    if (
      !source ||
      !parent?.children ||
      index < 0 ||
      index > parent.children.length
    )
      return false;
    const block = source.id ? this.find(source.id) : undefined;
    if (
      sharedPartPlacementError(
        block || { id: "", type: source.type || "", settings: {} },
        this.document()?.parts || {},
        this.part,
        this.rootLabel === "Main",
      )
    )
      return false;
    if (
      !canPlacePagination(
        this.root!,
        parent,
        block || { id: "", type: source.type || "", settings: {} },
      )
    )
      return false;
    if (!this.accepts(parent.type, block?.type || source.type || ""))
      return false;
    if (
      (block?.type || source.type) === "core/column" &&
      parent.type !== "core/columns"
    )
      return false;
    if (
      source.id &&
      (!block || !this.movable(block) || this.find(parentId, block))
    )
      return false;
    if (!source.id && !this.blocks.some((b) => b.type === source.type))
      return false;
    let depth = 0,
      ancestor: BlockNode | undefined = parent;
    while (ancestor && ancestor !== this.root) {
      depth++;
      ancestor = this.parent(ancestor.id);
    }
    const wrapped =
      parent.type === "core/columns" &&
      (block?.type || source.type) !== "core/column";
    return (
      depth +
        1 +
        (wrapped ? 1 : 0) +
        (block
          ? this.depth(block)
          : ["core/columns", "core/post-list"].includes(source.type || "")
            ? 1
            : 0) <=
      MAX_BLOCK_DEPTH
    );
  }
  dropBlock(parentId: string, index: number, source = this.dragSource) {
    if (!this.canDrop(parentId, index, source)) return false;
    if (source?.id) this.move(source.id, parentId, index);
    else if (source?.type) this.insert(source.type, parentId, index);
    this.dragSource = null;
    return true;
  }

  private currentTemplate = signal("home");
  private currentPart = signal("");
  get templateId() {
    return this.currentTemplate();
  }
  set templateId(value: string) {
    this.currentTemplate.set(value);
  }
  rootLabel: "Body" | "Main" = "Body";
  get part() {
    return this.currentPart();
  }
  set part(value: string) {
    this.currentPart.set(value);
  }
  error = "";
  notice = "";
  past: string[] = [];
  future: string[] = [];
  clipboard: BlockNode | null = null;
  saved = "";
  onChange = () => {};
  onEditPart?: (name: string) => void;
  onConfirmRemoval?: (
    title: string,
    message: string,
    confirmLabel: string,
  ) => Promise<boolean>;
  onDragStart = () => {};
  onDragEnd = () => {};
  onPointerStart?: (
    event: PointerEvent,
    source: { id?: string; type?: string },
  ) => void;
  get root() {
    const d = this.document();
    return d
      ? this.part
        ? d.parts[this.part]
        : d.templates[this.templateId]
      : undefined;
  }
  get blocks(): BlockDefinition[] {
    return [
      ...(definitions as BlockDefinition[]),
      ...(this.document()?.blocks || []).filter(
        (block) =>
          !definitions.some((builtin) => builtin.type === block.type) &&
          !sharedPartName(block.type),
      ),
      ...sharedPartDefinitions(
        this.document()?.parts || {},
        this.part,
        this.rootLabel === "Main",
      ),
    ];
  }
  /** The unique icon for a block type, falling back to a generic glyph. */
  iconFor(type: string) {
    return this.blocks.find((b) => b.type === type)?.icon || "fas fa-block";
  }
  get node() {
    return this.find(this.selected());
  }
  get dirty() {
    return JSON.stringify(this.document()) !== this.saved;
  }
  load(d: ThemeDocument) {
    this.document.set(structuredClone(d));
    this.saved = JSON.stringify(d);
    normalizeFormattedHtmlNames(this.document()!);
    normalizeContextDocument(this.document()!);
    const workspace = this.api.state();
    normalizeMenuDocument(
      this.document()!,
      workspace?.content,
      workspace?.settings || {},
    );
    const wrapped = normalizeDocumentColumns(this.document()!);
    this.ensureEmptyDocuments();
    this.notice = [
      ...(d.notices || []),
      ...(wrapped
        ? [
            `${wrapped} blocks were wrapped in Columns to match the current structure.`,
          ]
        : []),
    ].join(" ");
    this.past = [];
    this.future = [];
    if (!d.templates[this.templateId])
      this.templateId =
        d.manifest.templates.find((template) =>
          template.appliesTo.includes("home"),
        )?.id || d.manifest.templates[0].id;
    this.part = "";
    this.selected.set(this.initialSelection());
    this.onChange();
  }
  find(id: string, node = this.root): BlockNode | undefined {
    if (!node) return;
    return node.id === id
      ? node
      : node.children?.map((c) => this.find(id, c)).find(Boolean);
  }
  /** Only document roots get a starting paragraph; empty layout blocks stay empty. */
  private ensureEmptyDocuments() {
    const document = this.document();
    if (!document) return;
    for (const root of [
      ...Object.values(document.templates),
      ...Object.values(document.parts),
    ]) {
      if (root.type !== "core/container" || root.children?.length) continue;
      const paragraph = this.create("core/paragraph");
      root.children = [paragraph];
      if (root === this.root && this.selected() === root.id)
        this.selected.set(paragraph.id);
    }
  }
  initialSelection() {
    const root = this.root;
    const first = root?.children?.[0];
    return root?.children?.length === 1 &&
      first?.type === "core/paragraph" &&
      !first.settings["html"]
      ? first.id
      : root?.id || "";
  }
  parent(id: string, node = this.root): BlockNode | undefined {
    return node?.children?.some((c) => c.id === id)
      ? node
      : node?.children?.map((c) => this.parent(id, c)).find(Boolean);
  }
  label(b: BlockNode) {
    return b === this.root && !this.part
      ? this.rootLabel
      : this.blocks.find((d) => d.type === b.type)?.label || b.type;
  }
  protected(b: BlockNode) {
    return b === this.root;
  }
  movable(b: BlockNode) {
    return b !== this.root;
  }
  commit(change: () => void) {
    const before = JSON.stringify(this.document());
    this.error = "";
    try {
      change();
      this.ensureEmptyDocuments();
      const partError =
        sharedPartsError(this.document()!.parts) ||
        sharedPartPlacementError(
          this.root!,
          this.document()!.parts,
          this.part,
          this.rootLabel === "Main",
        );
      if (partError) throw Error(partError);
      if (!paginationPlacementValid(this.root!))
        throw Error(
          "Pagination must be inside a Post list or one of its layout blocks.",
        );
      if (this.depth(this.root!) > MAX_BLOCK_DEPTH)
        throw Error(`Blocks can be nested up to ${MAX_BLOCK_DEPTH} levels.`);
    } catch (e) {
      this.document.set(JSON.parse(before));
      this.error = (e as Error).message;
      return;
    }
    if (JSON.stringify(this.document()) === before) return;
    this.past.push(before);
    if (this.past.length > 100) this.past.shift();
    this.future = [];
    this.document.set(structuredClone(this.document()));
    this.onChange();
  }
  depth(b: BlockNode): number {
    return b.children?.length
      ? 1 + Math.max(...b.children.map((c) => this.depth(c)))
      : 0;
  }
  set(key: string, value: any) {
    this.commit(() => {
      if (this.node) {
        this.node.settings[key] = value;
        if (key === "text" && this.node.type === "core/heading")
          delete this.node.settings["html"];
      }
    });
  }
  nested(key: string, side: string, value: any) {
    this.set(key, { ...this.node?.settings[key], [side]: value });
  }
  create(type: string): BlockNode {
    const def = this.blocks.find((b) => b.type === type);
    if (!def) throw Error("Unknown block");
    if (def.disabled)
      throw Error(def.description || "This block cannot be placed here.");
    return {
      id: "blk_" + crypto.randomUUID(),
      type,
      settings: {
        ...(type === "core/menu" ? { automaticPages: false } : {}),
        ...Object.fromEntries(
          def.fields.map((f) => [f.key, structuredClone(f.default ?? "")]),
        ),
      },
      ...(def.container
        ? {
            children:
              type === "core/columns"
                ? [this.create("core/column"), this.create("core/column")]
                : type === "core/slider"
                  ? [this.create("core/slide"), this.create("core/slide")]
                  : type === "core/post-list"
                    ? postListChildren((childType, settings) => {
                        const child = this.create(childType);
                        Object.assign(child.settings, settings);
                        return child;
                      })
                    : type === "core/menu"
                      ? (this.api.state()?.content || [])
                          .filter(
                            (page) =>
                              page.kind === "page" &&
                              page.status === "published" &&
                              page.id !==
                                this.api.state()?.settings.notFoundPageId,
                          )
                          .map((page) => {
                            const item = this.create("core/menu-item");
                            item.settings["pageId"] = page.id;
                            item.settings["href"] = "";
                            return item;
                          })
                      : [],
          }
        : {}),
    };
  }
  copyTree(b: BlockNode): BlockNode {
    return {
      ...structuredClone(b),
      id: "blk_" + crypto.randomUUID(),
      ...(b.children
        ? { children: b.children.map((c) => this.copyTree(c)) }
        : {}),
    };
  }
  insertPattern(pattern: BlockPattern) {
    const selection = this.selected();
    this.commit(() => {
      let parent = this.node;
      if (!parent?.children)
        parent = parent ? this.parent(parent.id) : this.root;
      if (!parent?.children)
        throw Error("Choose a layout block for this pattern.");
      const blocks = clonePatternBlocks(pattern);
      parent.children.push(
        ...blocks.map((block) => this.forParent(block, parent!)),
      );
      applyOutlineCommand(
        this.root!,
        { type: "update", id: this.root!.id, settings: {} },
        this.blocks,
      );
      this.selected.set(blocks[0].id);
    });
    if (this.error) this.selected.set(selection);
  }
  insert(type: string, parentId?: string, index?: number) {
    this.commit(() => {
      let p = parentId ? this.find(parentId) : this.node;
      if (!p?.children) p = p ? this.parent(p.id) : this.root;
      if (!p?.children) throw Error("Choose a container for this block.");
      let i = index ?? p.children.length;
      const b = this.create(type);
      p.children.splice(i, 0, this.forParent(b, p));
      this.selected.set(b.id);
    });
  }
  insertFromParagraph(
    id: string,
    type: string,
    html: string,
    replace: boolean,
  ) {
    const node = this.find(id),
      parent = this.parent(id);
    if (!node || !parent?.children) return "";
    const index = parent.children.indexOf(node);
    if (!this.canDrop(parent.id, index, { type })) return "";
    const block = this.create(type);
    this.commit(() => {
      const wrapped = this.forParent(block, parent);
      if (replace) parent.children!.splice(index, 1, wrapped);
      else {
        node.settings["html"] = html;
        parent.children!.splice(index + 1, 0, wrapped);
      }
      this.selected.set(block.id);
    });
    return this.find(block.id) ? block.id : "";
  }
  move(id: string, parentId: string, index: number) {
    this.commit(() => {
      const b = this.find(id),
        p = this.find(parentId),
        old = this.parent(id);
      if (!b || !p?.children || !old || !this.movable(b))
        throw Error("The template root cannot be moved.");
      if (this.find(parentId, b))
        throw Error("A block cannot be placed inside itself.");
      const at = old.children!.indexOf(b);
      old.children!.splice(at, 1);
      if (old === p && at < index) index--;
      p.children.splice(index, 0, this.forParent(b, p));
      this.selected.set(id);
    });
  }
  shift(delta: number) {
    const b = this.node,
      p = b && this.parent(b.id);
    if (p && b) {
      const index = p.children!.indexOf(b);
      if (index + delta < 0 || index + delta >= p.children!.length) return;
      this.move(b.id, p.id, index + (delta > 0 ? 2 : -1));
    }
  }
  confirmRemoval(id: string): boolean | Promise<boolean> {
    return this.lastColumnGroup(id)
      ? (this.onConfirmRemoval?.(
          "Remove the last column?",
          "This also removes its Columns block and everything inside it. You can undo the change after removing it.",
          "Remove Columns",
        ) ?? false)
      : true;
  }
  lastColumnGroup(id: string) {
    const block = this.find(id),
      parent = this.parent(id);
    return block?.type === "core/column" &&
      parent?.type === "core/columns" &&
      parent.children?.length === 1
      ? parent
      : undefined;
  }
  remove(id = this.selected()) {
    const b = this.find(id);
    if (!b || this.protected(b)) return;
    const confirmation = this.confirmRemoval(id);
    if (typeof confirmation !== "boolean") {
      void confirmation.then((confirmed) => {
        if (confirmed) this.removeConfirmed(id);
      });
      return;
    }
    if (confirmation) this.removeConfirmed(id);
  }
  private removeConfirmed(id: string) {
    const b = this.find(id);
    if (!b || this.protected(b) || !this.parent(id)) return;
    this.commit(() => {
      const p = this.parent(b.id)!;
      if (
        b.type === "core/column" &&
        p.type === "core/columns" &&
        p.children?.length === 1
      ) {
        const outer = this.parent(p.id);
        if (outer?.children) {
          outer.children = outer.children.filter((child) => child !== p);
          this.selected.set(outer.id);
        }
        return;
      }
      p.children = p.children!.filter((c) => c !== b);
      this.selected.set(p.id);
    });
  }
  removeLastColumn() {
    const columns = this.node;
    if (columns?.type !== "core/columns" || !columns.children?.length) return;
    this.selected.set(columns.children.at(-1)!.id);
    this.remove();
  }
  copy() {
    if (this.node && !this.protected(this.node))
      this.clipboard = structuredClone(this.node);
  }
  cut() {
    if (!this.node || this.protected(this.node)) return;
    this.copy();
    this.remove();
  }
  pasteAfter() {
    if (!this.clipboard) return;
    this.commit(() => {
      const selected = this.node;
      const parent = selected && this.parent(selected.id);
      if (!selected || !parent?.children) return;
      const copy = this.copyTree(this.clipboard!);
      parent.children.splice(
        parent.children.indexOf(selected) + 1,
        0,
        this.forParent(copy, parent),
      );
      this.selected.set(copy.id);
    });
  }
  paste() {
    if (!this.clipboard) return;
    this.commit(() => {
      const selected = this.node;
      const p = selected?.children
        ? selected
        : selected
          ? this.parent(selected.id)
          : this.root;
      if (!p?.children) return;
      const b = this.copyTree(this.clipboard!);
      p.children.splice(p.children.length, 0, this.forParent(b, p));
      this.selected.set(b.id);
    });
  }
  duplicate() {
    const b = this.node,
      p = b && this.parent(b.id);
    if (!b || !p?.children || this.protected(b)) return;
    this.commit(() => {
      const copy = this.copyTree(b);
      p.children!.splice(p.children!.indexOf(b) + 1, 0, copy);
      this.selected.set(copy.id);
    });
  }
  private forParent(b: BlockNode, p: BlockNode): BlockNode {
    if (!canPlacePagination(this.root!, p, b))
      throw Error(
        "Pagination must be inside a Post list or one of its layout blocks.",
      );
    if (!this.accepts(p.type, b.type))
      throw Error(`${this.label(b)} cannot be placed inside ${this.label(p)}.`);
    if (b.type === "core/column" && p.type !== "core/columns")
      throw Error("Column blocks can only be placed inside a Columns block.");
    if (p.type !== "core/columns" || b.type === "core/column") return b;
    this.notice = "Wrapped in a Column.";
    const wrapper = this.create("core/column");
    wrapper.children = [b];
    return wrapper;
  }
  private accepts(parentType: string, childType: string) {
    if (["core/menu", "core/menu-item"].includes(parentType))
      return [
        "core/button",
        "core/menu-item",
        "core/custom-link",
        "core/search",
      ].includes(childType);
    if (childType === "core/menu-item") return false;
    if (parentType === "core/slider") return childType === "core/slide";
    if (childType === "core/slide") return false;
    if (parentType === "core/gltf") return childType === "core/overlay";
    if (childType === "core/overlay")
      return parentType === "core/slide" || parentType === "core/gltf";
    return true;
  }
  undo() {
    const d = this.past.pop();
    if (!d) return;
    this.future.push(JSON.stringify(this.document()));
    this.document.set(JSON.parse(d));
    normalizeDocumentColumns(this.document()!);
    this.onChange();
  }
  redo() {
    const d = this.future.pop();
    if (!d) return;
    this.past.push(JSON.stringify(this.document()));
    this.document.set(JSON.parse(d));
    normalizeDocumentColumns(this.document()!);
    this.onChange();
  }
}
