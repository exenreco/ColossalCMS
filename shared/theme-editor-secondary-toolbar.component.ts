import { Component, EventEmitter, Input, Output } from "@angular/core";
import { BlockIconComponent } from "./block-icon.component";

/** DOM order is also visual and keyboard order: authoring, history, preview. */
@Component({
  selector: "cl-theme-editor-secondary-toolbar",
  standalone: true,
  imports: [BlockIconComponent],
  template: `
    <div
      class="theme-editor-subbar"
      role="group"
      aria-label="Editor view and history"
    >
      <div class="cl-editor-secondary-toolbar__region--left">
        <button
          class="button toolbar-icon blocks-trigger"
          aria-label="Blocks"
          title="Blocks (Ctrl/Cmd+B)"
          aria-controls="block-library-drawer"
          [attr.aria-expanded]="blocksOpen"
          [class.primary]="blocksOpen"
          (click)="toggleBlocks.emit()"
        >
          <cl-block-icon icon="fas fa-bars" />
        </button>
        <button
          class="button toolbar-icon block-list-trigger"
          aria-label="Block list"
          title="Block list"
          aria-controls="block-list-drawer"
          [attr.aria-expanded]="blockListOpen"
          [class.primary]="blockListOpen"
          (click)="toggleBlockList.emit()"
        >
          <cl-block-icon icon="fas fa-list-ul" />
        </button>
        <div
          class="toolbar-segments"
          role="radiogroup"
          aria-label="View mode"
          (keydown)="navigate($event, 'mode')"
        >
          @for (view of views; track view.id) {
            <button
              class="button toolbar-icon"
              role="radio"
              [attr.aria-label]="view.label"
              [title]="view.title"
              [attr.aria-checked]="mode === view.id"
              [tabIndex]="mode === view.id ? 0 : -1"
              [class.primary]="mode === view.id"
              (click)="modeChange.emit(view.id)"
            >
              <cl-block-icon [icon]="view.icon" />
            </button>
          }
        </div>
      </div>
      <div class="cl-editor-secondary-toolbar__region--right">
        <button
          class="button toolbar-icon"
          aria-label="Undo"
          title="Undo (Ctrl/Cmd+Z)"
          [disabled]="!canUndo"
          (click)="undo.emit()"
        >
          <cl-block-icon icon="fas fa-undo" />
        </button>
        <button
          class="button toolbar-icon"
          aria-label="Redo"
          title="Redo (Ctrl/Cmd+Shift+Z)"
          [disabled]="!canRedo"
          (click)="redo.emit()"
        >
          <cl-block-icon icon="fas fa-redo" />
        </button>
        <span class="toolbar-divider" aria-hidden="true"></span>
        <div
          class="toolbar-segments"
          role="radiogroup"
          aria-label="Responsive preview"
          (keydown)="navigate($event, 'width')"
        >
          @for (size of sizes; track size.width; let i = $index) {
            <button
              class="button toolbar-icon"
              role="radio"
              [attr.aria-label]="size.name + ' preview'"
              [title]="size.name + ' (Ctrl/Cmd+' + (i + 1) + ')'"
              [attr.aria-checked]="width === size.width"
              [tabIndex]="width === size.width ? 0 : -1"
              [class.primary]="width === size.width"
              (click)="widthChange.emit(size.width)"
            >
              <cl-block-icon [icon]="size.icon" />
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class ThemeEditorSecondaryToolbarComponent {
  @Input() blocksOpen = false;
  @Input() blockListOpen = false;
  @Input() mode: "canvas" | "outline" = "canvas";
  @Input() width = 1200;
  @Input() canUndo = false;
  @Input() canRedo = false;
  @Output() toggleBlocks = new EventEmitter<void>();
  @Output() toggleBlockList = new EventEmitter<void>();
  @Output() modeChange = new EventEmitter<"canvas" | "outline">();
  @Output() widthChange = new EventEmitter<number>();
  @Output() undo = new EventEmitter<void>();
  @Output() redo = new EventEmitter<void>();
  views = [
    {
      id: "canvas" as const,
      label: "Canvas",
      title: "Canvas (Ctrl/Cmd+Shift+C)",
      icon: "fas fa-th-large",
    },
    {
      id: "outline" as const,
      label: "Outline",
      title: "Outline (Ctrl/Cmd+Shift+O)",
      icon: "fas fa-list",
    },
  ];
  sizes = [
    { name: "Desktop", width: 1200, icon: "fas fa-desktop" },
    { name: "Tablet", width: 768, icon: "fas fa-tablet-alt" },
    { name: "Mobile", width: 390, icon: "fas fa-mobile-alt" },
  ];
  /** One tab stop per group; arrow keys wrap, Home/End reach the extremes. */
  navigate(event: KeyboardEvent, group: "mode" | "width") {
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    const buttons = Array.from(
      (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '[role="radio"]',
      ),
    );
    const current = buttons.indexOf(event.target as HTMLButtonElement);
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (current +
              (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) +
              buttons.length) %
            buttons.length;
    if (group === "mode") this.modeChange.emit(this.views[index].id);
    else this.widthChange.emit(this.sizes[index].width);
    buttons[index].focus();
  }
}
