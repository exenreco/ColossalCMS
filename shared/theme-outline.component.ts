import {
  Component,
  Injector,
  afterNextRender,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
} from "@angular/core";
import { UiSurfaceComponent } from "./ui-surface.component";
import { ThemeBlockTreeComponent } from "./theme-block-tree.component";
import { ThemeOutlineApi, type OutlineAction } from "./theme-outline-api";
import { BlockIconComponent } from "./block-icon.component";
import { IconComponent } from "./icon.component";
import type { BlockNode } from "./theme-models";

@Component({
  selector: "cl-theme-outline",
  standalone: true,
  imports: [
    ThemeBlockTreeComponent,
    BlockIconComponent,
    IconComponent,
    UiSurfaceComponent,
  ],
  template: ` <section
      class="outline-surface"
      [class.compact]="compact"
      [class.block-list-view]="view === 'list'"
      [attr.aria-label]="
        view === 'list' ? 'Canvas block list' : 'Block outline'
      "
      (cl-outline-menu)="openMenu($event)"
      (keydown)="treeKey($event)"
    >
      <header class="outline-heading">
        <div>
          <span class="outline-eyebrow">{{
            api.state.part
              ? "SHARED PART"
              : view === "list"
                ? "BLOCK LIST"
                : "DOCUMENT STRUCTURE"
          }}</span>
          <h2>{{ title }}</h2>
        </div>
        <div class="outline-heading-actions">
          <span class="outline-count">{{ blockCount }} blocks</span
          ><button
            type="button"
            aria-label="Expand all blocks"
            title="Expand all"
            (click)="api.expandAll()"
          >
            <cl-block-icon icon="fas fa-expand-alt" /></button
          ><button
            type="button"
            aria-label="Collapse all blocks"
            title="Collapse all"
            (click)="api.collapseAll()"
          >
            <cl-block-icon icon="fas fa-compress-alt" />
          </button>
        </div>
      </header>
      @if (api.state.root; as root) {
        <div
          class="outline-document-controls"
          (click)="$event.stopPropagation()"
        >
          <button
            class="outline-document-settings"
            type="button"
            [attr.data-outline-settings-id]="root.id"
            [attr.aria-pressed]="api.state.selected() === root.id"
            (focus)="api.dispatch({ type: 'select', id: root.id })"
            (click)="selectSettings()"
            (keydown.arrowdown)="focusFirstBlock($event)"
            (contextmenu)="documentMenu($event)"
          >
            <cl-block-icon [icon]="api.icon(root)" />
            <span>{{ settingsLabel }}</span>
            <cl-icon name="settings" />
          </button>
          <button
            class="outline-document-add"
            type="button"
            aria-label="Add top-level block"
            title="Add top-level block"
            (click)="documentMenu($event, 'insert')"
          >
            <cl-icon name="plus" />
          </button>
        </div>
      }
      <div class="outline-tree" role="tree" aria-label="Document blocks">
        @if (api.state.root; as root) {
          <cl-theme-block-tree [node]="root" [childrenOnly]="true" />
        }
      </div>
      <footer class="outline-footer">
        <span
          ><span class="outline-status-dot"></span
          >{{
            api.state.dirty
              ? "Changes in this draft"
              : "All blocks in this document"
          }}</span
        ><span>Drag to arrange · Right-click for actions</span>
      </footer>
    </section>
    @if (menuId()) {
      <cl-ui-surface
        #menu
        kind="menu"
        [open]="!!menuId()"
        label="Block actions"
        panelClass="outline-context-menu"
        [point]="menuPoint"
        [anchor]="anchor"
        [width]="280"
        [restoreFocus]="false"
        (dismissed)="closeMenu(false)"
      >
        <div (keydown)="menuKey($event)">
          <div class="outline-menu-title">
            {{
              api.state.find(menuId())
                ? api.label(api.state.find(menuId())!)
                : "Block"
            }}
          </div>
          @if (menuMode() === "insert") {
            <button
              role="menuitem"
              type="button"
              (click)="setMenuMode('actions')"
            >
              <cl-icon name="chevron" /><span>Back to actions</span>
            </button>
            <label class="outline-insert-search"
              ><cl-icon name="search" /><input
                aria-label="Find a block to insert"
                placeholder="Find a block…"
                [value]="insertSearch()"
                (input)="insertSearch.set($any($event.target).value)"
            /></label>
            <div class="outline-insert-options">
              @for (block of insertOptions; track block.type) {
                <button
                  role="menuitem"
                  type="button"
                  [disabled]="!canInsert(block.type)"
                  (click)="insert(block.type)"
                >
                  <cl-block-icon
                    [icon]="block.icon || 'fas fa-block'"
                  /><span>{{ block.label }}</span>
                </button>
              } @empty {
                <p>No matching blocks.</p>
              }
            </div>
          } @else {
            <button
              role="menuitem"
              type="button"
              (click)="setMenuMode('insert')"
            >
              <cl-icon name="plus" /><span>Add block</span
              ><cl-icon name="chevron" />
            </button>
            <button
              role="menuitem"
              type="button"
              [disabled]="menuId() === api.state.root?.id"
              (click)="rename()"
            >
              <cl-block-icon icon="fas fa-pen" /><span>Rename label</span
              ><kbd>F2</kbd>
            </button>
            @if (api.canRun("edit-part", menuId())) {
              <button
                role="menuitem"
                type="button"
                (click)="action('edit-part')"
              >
                <cl-icon name="external" /><span>Edit shared part</span>
              </button>
            }
            <div class="outline-menu-divider" role="separator"></div>
            @for (item of clipboardActions; track item.action) {
              <button
                role="menuitem"
                type="button"
                [disabled]="!canAction(item.action, menuId())"
                (click)="action(item.action)"
              >
                <cl-block-icon [icon]="item.icon" /><span>{{ item.label }}</span
                ><kbd>{{ item.shortcut }}</kbd>
              </button>
            }
            <div class="outline-menu-divider" role="separator"></div>
            <button
              role="menuitem"
              type="button"
              [disabled]="!api.canRun('up', menuId())"
              (click)="action('up')"
            >
              <cl-block-icon icon="fas fa-arrow-up" /><span>Move up</span>
            </button>
            <button
              role="menuitem"
              type="button"
              [disabled]="!api.canRun('down', menuId())"
              (click)="action('down')"
            >
              <cl-block-icon icon="fas fa-arrow-down" /><span>Move down</span>
            </button>
            <div class="outline-menu-divider" role="separator"></div>
            <button
              role="menuitem"
              type="button"
              [disabled]="!api.state.past.length"
              (click)="history('undo')"
            >
              <cl-block-icon icon="fas fa-undo" /><span>Undo</span
              ><kbd>⌘/Ctrl Z</kbd>
            </button>
            <button
              role="menuitem"
              type="button"
              [disabled]="!api.state.future.length"
              (click)="history('redo')"
            >
              <cl-block-icon icon="fas fa-redo" /><span>Redo</span
              ><kbd>⇧ Z</kbd>
            </button>
            <div class="outline-menu-divider" role="separator"></div>
            <button
              class="outline-menu-danger"
              role="menuitem"
              type="button"
              [disabled]="!canAction('remove', menuId())"
              (click)="action('remove')"
            >
              <cl-icon name="trash" /><span>Delete block</span><kbd>Del</kbd>
            </button>
          }
        </div>
      </cl-ui-surface>
    }`,
})
export class ThemeOutlineComponent {
  @Input() compact = false;
  @Input() view: "list" | "outline" = "outline";
  @Output() settingsOpen = new EventEmitter<void>();
  api = inject(ThemeOutlineApi);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  menuId = signal("");
  menuMode = signal("actions");
  insertSearch = signal("");
  @ViewChild("menu") surface?: UiSurfaceComponent;
  get menuElement() {
    return this.surface?.panel?.nativeElement;
  }
  anchor?: HTMLElement;
  menuPoint = { x: 0, y: 0 };
  clipboardActions: {
    action: OutlineAction;
    label: string;
    icon: string;
    shortcut: string;
  }[] = [
    {
      action: "duplicate",
      label: "Duplicate",
      icon: "fas fa-clone",
      shortcut: "⌘/Ctrl D",
    },
    {
      action: "copy",
      label: "Copy",
      icon: "fas fa-copy",
      shortcut: "⌘/Ctrl C",
    },
    { action: "cut", label: "Cut", icon: "fas fa-cut", shortcut: "⌘/Ctrl X" },
    {
      action: "paste-after",
      label: "Paste after",
      icon: "fas fa-paste",
      shortcut: "⌘/Ctrl V",
    },
    {
      action: "paste-inside",
      label: "Paste inside",
      icon: "fas fa-paste",
      shortcut: "",
    },
  ];
  private positionMenu() {
    this.surface?.position();
  }
  private focusMenu() {
    this.menuElement
      ?.querySelector<HTMLElement>(
        this.menuMode() === "insert" ? "input" : "button:not(:disabled)",
      )
      ?.focus();
  }
  setMenuMode(mode: "actions" | "insert") {
    this.menuMode.set(mode);
    requestAnimationFrame(() => {
      if (!this.menuElement?.isConnected) return;
      this.positionMenu();
      this.focusMenu();
    });
  }
  get title() {
    return this.api.state.part
      ? this.api.state.part[0].toUpperCase() + this.api.state.part.slice(1)
      : this.api.state
          .document()
          ?.manifest.templates.find(
            (template) => template.id === this.api.state.templateId,
          )?.name || this.api.state.rootLabel;
  }
  get blockCount() {
    const count = (node: BlockNode): number =>
      1 +
      (node.children || []).reduce(
        (total: number, child: BlockNode) => total + count(child),
        0,
      );
    return this.api.state.root ? count(this.api.state.root) - 1 : 0;
  }
  get settingsLabel() {
    return (
      (this.api.state.part ? this.title : this.api.state.rootLabel) +
      " settings"
    );
  }
  selectSettings() {
    const root = this.api.state.root;
    if (root) {
      this.api.dispatch({ type: "select", id: root.id });
      this.settingsOpen.emit();
    }
  }
  focusFirstBlock(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.host.nativeElement
      .querySelector<HTMLElement>(".theme-tree-row")
      ?.focus();
  }
  documentMenu(event: MouseEvent, mode = "actions") {
    event.preventDefault();
    event.stopPropagation();
    const root = this.api.state.root;
    if (!root) return;
    const anchor = event.currentTarget as HTMLElement;
    const rect = anchor.getBoundingClientRect();
    this.openMenu(
      new CustomEvent("cl-outline-menu", {
        detail: {
          id: root.id,
          x: event.type === "contextmenu" ? event.clientX : rect.left,
          y: event.type === "contextmenu" ? event.clientY : rect.bottom + 6,
          anchor,
          mode,
        },
      }),
    );
  }
  get insertOptions() {
    return this.api.state.blocks.filter(
      (block) =>
        !block.legacy &&
        block.label.toLowerCase().includes(this.insertSearch().toLowerCase()),
    );
  }
  private destination() {
    const node = this.api.state.find(this.menuId());
    const parent = node?.children
      ? node
      : node && this.api.state.parent(node.id);
    return node && parent?.children
      ? {
          parentId: parent.id,
          index: node.children
            ? node.children.length
            : parent.children.indexOf(node) + 1,
        }
      : null;
  }
  canInsert(type: string) {
    const target = this.destination();
    return (
      !!target &&
      this.api.state.canDrop(target.parentId, target.index, { type })
    );
  }
  insert(blockType: string) {
    const target = this.destination();
    if (target && this.canInsert(blockType)) {
      this.api.dispatch({ type: "insert", blockType, ...target });
      this.closeMenu();
      this.focusSelected();
    }
  }
  openMenu(event: Event) {
    const detail = (event as CustomEvent).detail;
    if (!detail?.id) return;
    this.closeMenu(false);
    this.anchor = detail.anchor;
    this.menuPoint = { x: detail.x, y: detail.y };
    this.api.dispatch({ type: "select", id: detail.id });
    this.menuMode.set(detail.mode || "actions");
    this.insertSearch.set("");
    this.menuId.set(detail.id);
  }
  closeMenu(restoreFocus = true) {
    this.menuId.set("");
    if (restoreFocus) this.anchor?.focus();
  }
  action(action: OutlineAction) {
    const id = this.menuId();
    this.closeMenu(false);
    this.runAction(action, id);
  }
  private runAction(action: OutlineAction, id: string) {
    if (!this.canAction(action, id)) return;
    const run = () => {
      const group =
        (action === "remove" || action === "cut") &&
        this.api.state.lastColumnGroup(id);
      // The public API protects a group's last child. After UI confirmation,
      // remove its Columns parent explicitly; cutting still copies the Column.
      if (group) {
        if (action === "cut" && !this.api.dispatch({ type: "copy", id }))
          return;
        this.api.dispatch({ type: "remove", id: group.id });
      } else this.api.dispatch({ type: action, id });
      this.focusSelected();
    };
    const confirmation =
      action === "remove" || action === "cut"
        ? this.api.state.confirmRemoval(id)
        : true;
    if (typeof confirmation === "boolean") {
      if (confirmation) run();
    } else
      void confirmation.then((confirmed) => {
        if (confirmed) run();
      });
  }
  canAction(action: OutlineAction, id: string) {
    const group =
      (action === "remove" || action === "cut") &&
      this.api.state.lastColumnGroup(id);
    return group
      ? this.api.canRun("remove", group.id) &&
          (action !== "cut" || this.api.canRun("copy", id))
      : this.api.canRun(action, id);
  }
  history(type: "undo" | "redo") {
    this.closeMenu(false);
    this.api.dispatch({ type });
    this.focusSelected();
  }
  rename() {
    const id = this.menuId();
    this.closeMenu(false);
    this.api.renaming.set(id);
  }
  private injector = inject(Injector);
  private focusSelected() {
    const id = this.api.state.selected();
    // New rows appear after Angular renders. Never focus Body as a fallback for
    // a newly inserted block: its focus handler would replace that selection.
    afterNextRender(
      () => {
        if (
          !this.host.nativeElement.isConnected ||
          this.api.state.selected() !== id
        )
          return;
        const selected = Array.from(
          this.host.nativeElement.querySelectorAll<HTMLElement>(
            ".theme-tree-row",
          ),
        ).find((row) => row.parentElement?.dataset["outlineId"] === id);
        if (selected) selected.focus();
        else if (id === this.api.state.root?.id) this.settingsButton?.focus();
      },
      { injector: this.injector },
    );
  }
  menuKey(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      this.closeMenu();
      return;
    }
    if (event.key === "Tab") {
      this.closeMenu(false);
      return;
    }
    if (event.target instanceof HTMLInputElement) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        requestAnimationFrame(() =>
          this.menuElement
            ?.querySelector<HTMLElement>(
              ".outline-insert-options button:not(:disabled)",
            )
            ?.focus(),
        );
      }
      return;
    }
    const buttons = Array.from(
      this.menuElement!.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ),
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      buttons[
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
              buttons.length
      ]?.focus();
    }
  }
  treeKey(event: KeyboardEvent) {
    if (
      (event.target as HTMLElement).closest(
        "input,textarea,[contenteditable=true]",
      )
    )
      return;
    if ((event.target as HTMLElement).matches(".outline-document-settings")) {
      if (
        event.key === "ContextMenu" ||
        (event.shiftKey && event.key === "F10")
      ) {
        event.preventDefault();
        event.stopPropagation();
        const anchor = event.target as HTMLElement;
        const rect = anchor.getBoundingClientRect();
        this.openMenu(
          new CustomEvent("cl-outline-menu", {
            detail: {
              id: this.api.state.root!.id,
              x: rect.left,
              y: rect.bottom + 6,
              anchor,
            },
          }),
        );
      }
      return;
    }
    const row = (event.target as HTMLElement).closest<HTMLElement>(
      ".theme-tree-row",
    );
    if (!row) return;
    const id = row.parentElement!.dataset["outlineId"]!,
      node = this.api.state.find(id)!;
    if (
      event.key === "ContextMenu" ||
      (event.shiftKey && event.key === "F10")
    ) {
      event.preventDefault();
      event.stopPropagation();
      const rect = row.getBoundingClientRect();
      this.openMenu(
        new CustomEvent("cl-outline-menu", {
          detail: { id, x: rect.left + 40, y: rect.bottom, anchor: row },
        }),
      );
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      const actions: Record<string, OutlineAction> = {
        c: "copy",
        x: "cut",
        v: "paste-after",
        d: "duplicate",
      };
      const key = event.key.toLowerCase();
      if (actions[key] && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        this.runAction(actions[key], id);
      }
      if (key === "z" || key === "y") {
        event.preventDefault();
        event.stopPropagation();
        this.api.dispatch({
          type: key === "y" || event.shiftKey ? "redo" : "undo",
        });
        this.focusSelected();
      }
      return;
    }
    if (event.key === "F2") {
      event.preventDefault();
      event.stopPropagation();
      if (node !== this.api.state.root) this.api.renaming.set(id);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      if (this.canAction("remove", id)) this.runAction("remove", id);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.api.dispatch({ type: "select", id });
      return;
    }
    const rows = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(".theme-tree-row"),
    ).filter((item) => !item.closest("[inert]"));
    const index = rows.indexOf(row);
    let next: HTMLElement | undefined;
    if (event.key === "ArrowUp")
      next = index === 0 ? this.settingsButton : rows[index - 1];
    if (event.key === "ArrowDown")
      next = rows[Math.min(rows.length - 1, index + 1)];
    if (event.key === "Home") next = rows[0];
    if (event.key === "End") next = rows.at(-1);
    if (event.key === "ArrowRight") {
      if (node.children && this.api.isCollapsed(id)) this.api.toggle(id);
      else if (node.children?.length) next = rows[index + 1];
    }
    if (event.key === "ArrowLeft") {
      if (node.children && !this.api.isCollapsed(id)) this.api.toggle(id);
      else {
        const parent = this.api.state.parent(id);
        next = rows.find(
          (item) => item.parentElement?.dataset["outlineId"] === parent?.id,
        );
        if (parent === this.api.state.root) next = this.settingsButton;
      }
    }
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
      ].includes(event.key)
    ) {
      event.preventDefault();
      event.stopPropagation();
      next?.focus();
    }
  }
  private get settingsButton() {
    return (
      this.host.nativeElement.querySelector<HTMLElement>(
        ".outline-document-settings",
      ) || undefined
    );
  }
  @HostListener("document:pointerdown", ["$event"]) outside(
    event: PointerEvent,
  ) {
    if (this.menuId() && !this.menuElement?.contains(event.target as Node))
      this.closeMenu(false);
  }
  @HostListener("window:resize") resized() {
    this.closeMenu(false);
  }
}
