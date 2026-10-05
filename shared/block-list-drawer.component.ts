import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Output,
  ViewChild,
  inject,
} from "@angular/core";
import { ThemeEditorState } from "./theme-editor-state";
import { ThemeBlockTreeComponent } from "./theme-block-tree.component";

/** The current canvas tree, shared by theme, page, and post editors. */
@Component({
  selector: "cl-block-list-drawer",
  standalone: true,
  imports: [ThemeBlockTreeComponent],
  template: `
    <section class="block-list-drawer" aria-label="Canvas block list">
      <div class="drawer-heading">
        <strong>Block list</strong>
        <button type="button" class="button small" (click)="dismiss()">
          Close
        </button>
      </div>
      <p class="muted">
        Drag blocks to rearrange this canvas. Right-click a block for actions.
      </p>
      <div class="block-list-tree" (contextmenu)="openMenu($event)">
        @if (state.root; as root) {
          <cl-theme-block-tree [node]="root" />
        }
      </div>
      @if (menuOpen) {
        <div
          #menu
          class="block-list-menu"
          popover="manual"
          role="menu"
          aria-label="Block actions"
          [style.left.px]="menuX"
          [style.top.px]="menuY"
        >
          <button
            type="button"
            role="menuitem"
            [disabled]="!canEdit"
            (click)="action('copy')"
          >
            Copy
          </button>
          <button
            type="button"
            role="menuitem"
            [disabled]="!canEdit"
            (click)="action('cut')"
          >
            Cut
          </button>
          <button
            type="button"
            role="menuitem"
            [disabled]="!canPaste"
            (click)="action('paste')"
          >
            Paste after
          </button>
          <button
            type="button"
            role="menuitem"
            [disabled]="!canEdit"
            (click)="action('duplicate')"
          >
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            [disabled]="!canEdit"
            (click)="action('up')"
          >
            Move up
          </button>
          <button
            type="button"
            role="menuitem"
            [disabled]="!canEdit"
            (click)="action('down')"
          >
            Move down
          </button>
          <button
            type="button"
            role="menuitem"
            [disabled]="!canEdit"
            (click)="action('remove')"
          >
            Remove
          </button>
        </div>
      }
    </section>
  `,
})
export class BlockListDrawerComponent {
  state = inject(ThemeEditorState);
  @Output() close = new EventEmitter<void>();
  @ViewChild("menu") menu?: ElementRef<HTMLElement>;
  menuOpen = false;
  menuX = 0;
  menuY = 0;
  get canEdit() {
    return !!this.state.node && !this.state.protected(this.state.node);
  }
  get canPaste() {
    const node = this.state.node;
    const parent = node && this.state.parent(node.id);
    return !!(
      this.state.clipboard &&
      node &&
      parent?.children &&
      this.state.canDrop(parent.id, parent.children.indexOf(node) + 1, {
        type: this.state.clipboard.type,
      })
    );
  }
  closeMenu() {
    if (this.menu?.nativeElement.matches(":popover-open"))
      this.menu.nativeElement.hidePopover();
    this.menuOpen = false;
  }
  dismiss() {
    this.closeMenu();
    this.close.emit();
  }
  openMenu(event: MouseEvent) {
    const row = (event.target as HTMLElement).closest<HTMLElement>(
      ".theme-tree-row",
    );
    const id =
      row?.closest<HTMLElement>(".theme-tree-node")?.dataset["outlineId"];
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    this.state.selected.set(id);
    this.menuX = Math.min(event.clientX, window.innerWidth - 170);
    this.menuY = Math.min(event.clientY, window.innerHeight - 270);
    this.menuOpen = true;
    setTimeout(() => this.menu?.nativeElement.showPopover());
  }
  action(
    kind: "copy" | "cut" | "paste" | "duplicate" | "up" | "down" | "remove",
  ) {
    this.closeMenu();
    if (kind === "copy") this.state.copy();
    if (kind === "cut") this.state.cut();
    if (kind === "paste") this.state.pasteAfter();
    if (kind === "duplicate") this.state.duplicate();
    if (kind === "up") this.state.shift(-1);
    if (kind === "down") this.state.shift(1);
    if (kind === "remove") this.state.remove();
  }
  @HostListener("document:pointerdown", ["$event"])
  outside(event: PointerEvent) {
    if (!(event.target as HTMLElement).closest(".block-list-menu"))
      this.closeMenu();
  }
  @HostListener("document:keydown.escape")
  escape() {
    this.closeMenu();
  }
}
