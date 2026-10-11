import {
  Injectable,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { ThemeEditorState } from "./theme-editor-state";
import type { BlockNode } from "./theme-models";
import { sharedPartPlacementError } from "./shared-part-blocks";
import {
  applyOutlineCommand,
  outlineIcon,
  outlineLabel,
  outlineSnapshot,
  type OutlineCommand,
} from "./outline-document";

export type OutlineAction =
  | "copy"
  | "cut"
  | "paste-after"
  | "paste-inside"
  | "duplicate"
  | "remove"
  | "up"
  | "down"
  | "edit-part";
export type EditorOutlineCommand =
  | OutlineCommand
  | {
      type:
        | "select"
        | "expand"
        | "collapse"
        | "edit-part"
        | "copy"
        | "cut"
        | "paste-after"
        | "paste-inside"
        | "up"
        | "down";
      id: string;
    }
  | { type: "undo" | "redo" };

/** Versioned editor integration. UI and reviewed extensions share this boundary. */
@Injectable()
export class ThemeOutlineApi implements OnDestroy {
  state = inject(ThemeEditorState);
  collapsed = signal(new Set<string>());
  renaming = signal("");
  private clipboardVersion = signal(0);
  private subscribers = new Set<
    (snapshot: ReturnType<ThemeOutlineApi["getOutline"]>) => void
  >();
  snapshot = computed(() => {
    this.clipboardVersion();
    const root = this.state.root;
    const selectedId = this.state.selected();
    return root
      ? {
          ...outlineSnapshot(
            root,
            this.state.blocks,
            this.state.part
              ? this.state.part + " · shared part"
              : this.state.rootLabel,
          ),
          themeId: this.state.document()!.manifest.id,
          templateId: this.state.templateId,
          part: this.state.part || null,
          selectedId,
          collapsedIds: [...this.collapsed()],
          canUndo: !!this.state.past.length,
          canRedo: !!this.state.future.length,
        }
      : null;
  });
  constructor() {
    effect(() => {
      const snapshot = this.snapshot();
      for (const notify of this.subscribers) {
        try {
          notify(structuredClone(snapshot));
        } catch {
          /* An extension must not interrupt the editor. */
        }
      }
    });
    if (typeof window !== "undefined") {
      window.colossalThemeEditor = this;
      window.dispatchEvent(
        new CustomEvent("colossal:outline-ready", {
          detail: { api: this, apiVersion: 1 },
        }),
      );
    }
  }
  ngOnDestroy() {
    if (typeof window !== "undefined" && window.colossalThemeEditor === this)
      delete window.colossalThemeEditor;
    this.subscribers.clear();
  }
  getOutline() {
    return structuredClone(this.snapshot());
  }
  subscribe(
    notify: (snapshot: ReturnType<ThemeOutlineApi["getOutline"]>) => void,
  ) {
    this.subscribers.add(notify);
    notify(this.getOutline());
    return () => this.subscribers.delete(notify);
  }
  label(node: BlockNode) {
    return outlineLabel(
      node,
      this.state.blocks,
      this.state.part ? undefined : this.state.root,
      this.state.rootLabel,
    );
  }
  icon(node: BlockNode) {
    return node === this.state.root && !this.state.part
      ? this.state.rootLabel === "Main"
        ? "fas fa-file-alt"
        : "fas fa-file-code"
      : outlineIcon(node, this.state.blocks);
  }
  isCollapsed(id: string) {
    return this.collapsed().has(id);
  }
  toggle(id: string) {
    this.dispatch({ type: this.isCollapsed(id) ? "expand" : "collapse", id });
  }
  expandAll() {
    this.collapsed.set(new Set());
  }
  collapseAll() {
    const ids = new Set<string>();
    const visit = (node: BlockNode) => {
      if (node !== this.state.root && node.children?.length) ids.add(node.id);
      node.children?.forEach(visit);
    };
    if (this.state.root) visit(this.state.root);
    this.collapsed.set(ids);
    if (this.state.root) this.state.selected.set(this.state.root.id);
  }
  private reveal(id: string) {
    const next = new Set(this.collapsed());
    let parent = this.state.parent(id);
    while (parent) {
      next.delete(parent.id);
      parent = this.state.parent(parent.id);
    }
    this.collapsed.set(next);
  }
  canRun(action: OutlineAction, id: string): boolean {
    const node = this.state.find(id);
    if (!node) return false;
    const parent = this.state.parent(id);
    if (action === "edit-part") return node.type.startsWith("theme/part-");
    if (action === "up" || action === "down")
      return (
        !!parent?.children &&
        (action === "up"
          ? parent.children.indexOf(node) > 0
          : parent.children.indexOf(node) < parent.children.length - 1)
      );
    if (action === "copy") return !this.state.protected(node);
    if (action === "cut")
      return !this.state.protected(node) && this.canRun("remove", id);
    if (action === "paste-after" || action === "paste-inside") {
      if (!this.state.clipboard) return false;
      const target = action === "paste-inside" ? node : parent;
      if (!target?.children) return false;
      return this.valid({
        type: "paste",
        parentId: target.id,
        index:
          action === "paste-inside"
            ? target.children.length
            : target.children.indexOf(node) + 1,
        node: this.state.clipboard,
      });
    }
    return this.valid({ type: action, id } as OutlineCommand);
  }
  private valid(command: OutlineCommand) {
    if (!this.state.root) return false;
    try {
      const root = structuredClone(this.state.root);
      applyOutlineCommand(root, command, this.state.blocks);
      return !sharedPartPlacementError(
        root,
        this.state.document()?.parts || {},
        this.state.part,
        this.state.rootLabel === "Main",
      );
    } catch {
      return false;
    }
  }
  dispatch(command: EditorOutlineCommand): boolean {
    if (command.type === "undo" || command.type === "redo") {
      this.state[command.type]();
      if (!this.state.node && this.state.root)
        this.state.selected.set(this.state.root.id);
      this.reveal(this.state.selected());
      return true;
    }
    const id = "id" in command ? command.id : this.state.selected();
    const node = this.state.find(id);
    if (command.type === "select") {
      if (!node) return false;
      this.state.selected.set(id);
      this.reveal(id);
      return true;
    }
    if (command.type === "expand" || command.type === "collapse") {
      if (!node?.children || node === this.state.root) return false;
      const next = new Set(this.collapsed());
      command.type === "collapse" ? next.add(id) : next.delete(id);
      if (
        command.type === "collapse" &&
        this.state.selected() !== id &&
        this.state.find(this.state.selected(), node)
      )
        this.state.selected.set(id);
      this.collapsed.set(next);
      return true;
    }
    if (command.type === "edit-part") {
      if (!node?.type.startsWith("theme/part-")) return false;
      if (this.state.onEditPart) {
        this.state.onEditPart(node.type.slice(11));
        return true;
      }
      this.state.part = node.type.slice(11);
      this.state.selected.set(this.state.initialSelection());
      this.state.onChange();
      return true;
    }
    if (command.type === "copy" || command.type === "cut") {
      if (!this.canRun(command.type, id) || !node) return false;
      this.state.clipboard = structuredClone(node);
      this.clipboardVersion.update((value) => value + 1);
      return command.type === "cut"
        ? this.dispatch({ type: "remove", id })
        : true;
    }
    if (command.type === "paste-after" || command.type === "paste-inside") {
      if (!this.canRun(command.type, id) || !node) return false;
      const parent =
        command.type === "paste-inside" ? node : this.state.parent(id)!;
      return this.dispatch({
        type: "paste",
        parentId: parent.id,
        index:
          command.type === "paste-inside"
            ? parent.children!.length
            : parent.children!.indexOf(node) + 1,
        node: this.state.clipboard!,
      });
    }
    if (command.type === "up" || command.type === "down") {
      if (!node || !this.canRun(command.type, id)) return false;
      const parent = this.state.parent(id)!;
      return this.dispatch({
        type: "move",
        id,
        parentId: parent.id,
        index:
          parent.children!.indexOf(node) + (command.type === "up" ? -1 : 2),
      });
    }
    let selected = "";
    this.state.commit(() => {
      if (!this.state.root) throw Error("No outline is open.");
      selected = applyOutlineCommand(
        this.state.root,
        command as OutlineCommand,
        this.state.blocks,
      );
    });
    if (this.state.error) return false;
    if (selected) {
      this.state.selected.set(selected);
      this.reveal(selected);
    }
    return true;
  }
}
declare global {
  interface Window {
    colossalThemeEditor?: ThemeOutlineApi;
  }
}
