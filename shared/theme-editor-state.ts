import { Injectable, signal } from "@angular/core";
import { BlockDefinition, BlockNode, ThemeDocument } from "./theme-models";
import definitions from "./theme-blocks.json";
import { normalizeDocumentColumns } from "./theme-layout";

/** A bounded undo journal shared by the outline, drop targets and inspector. */
@Injectable()
export class ThemeEditorState {
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
        (block ? this.depth(block) : source.type === "core/columns" ? 1 : 0) <=
      8
    );
  }
  dropBlock(parentId: string, index: number, source = this.dragSource) {
    if (!this.canDrop(parentId, index, source)) return false;
    if (source?.id) this.move(source.id, parentId, index);
    else if (source?.type) this.insert(source.type, parentId, index);
    this.dragSource = null;
    return true;
  }

  templateId = "home";
  rootLabel: "Body" | "Main" = "Body";
  part = "";
  error = "";
  notice = "";
  past: string[] = [];
  future: string[] = [];
  clipboard: BlockNode | null = null;
  saved = "";
  onChange = () => {};
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
        (block) => !definitions.some((builtin) => builtin.type === block.type),
      ),
      {
        type: "core/html",
        label: "HTML fragment",
        category: "Theme",
        icon: "fas fa-code",
        fields: [{ key: "html", label: "Sanitized HTML", type: "textarea" }],
      },
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
    const wrapped = normalizeDocumentColumns(this.document()!);
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
    this.selected.set(this.root!.id);
    this.onChange();
  }
  find(id: string, node = this.root): BlockNode | undefined {
    if (!node) return;
    return node.id === id
      ? node
      : node.children?.map((c) => this.find(id, c)).find(Boolean);
  }
  parent(id: string, node = this.root): BlockNode | undefined {
    return node?.children?.some((c) => c.id === id)
      ? node
      : node?.children?.map((c) => this.parent(id, c)).find(Boolean);
  }
  label(b: BlockNode) {
    return b === this.root && !this.part
      ? this.rootLabel
      : b.type.startsWith("theme/part-")
        ? b.type.replace("theme/part-", "") + " · shared part"
        : this.blocks.find((d) => d.type === b.type)?.label || b.type;
  }
  protected(b: BlockNode) {
    return b === this.root || b.type.startsWith("theme/part-");
  }
  movable(b: BlockNode) {
    return b !== this.root;
  }
  commit(change: () => void) {
    const before = JSON.stringify(this.document());
    this.error = "";
    try {
      change();
      if (this.depth(this.root!) > 8)
        throw Error("Blocks can be nested up to eight levels.");
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
    return {
      id: "blk_" + crypto.randomUUID(),
      type,
      settings: Object.fromEntries(
        def.fields.map((f) => [f.key, structuredClone(f.default ?? "")]),
      ),
      ...(def.container
        ? {
            children:
              type === "core/columns"
                ? [this.create("core/column"), this.create("core/column")]
                : type === "core/slider"
                  ? [this.create("core/slide"), this.create("core/slide")]
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
  remove() {
    const b = this.node;
    if (!b || this.protected(b)) return;
    const parent = this.parent(b.id);
    if (
      b.type === "core/column" &&
      parent?.type === "core/columns" &&
      parent.children?.length === 1 &&
      !confirm(
        "This will remove the last column and the Columns block. Continue?",
      )
    )
      return;
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
