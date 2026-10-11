import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BlockIconComponent } from "./block-icon.component";
import { EditorIconComponent } from "./editor-icon.component";
import { UiSurfaceComponent } from "./ui-surface.component";
import { ICON_CATALOG, iconName, searchIcons } from "./icon-catalog";

/** Inspector control and searchable modal, shared by every block editor. */
@Component({
  selector: "cl-icon-picker",
  standalone: true,
  imports: [
    FormsModule,
    BlockIconComponent,
    EditorIconComponent,
    UiSurfaceComponent,
  ],
  template: `
    <div class="icon-picker-control">
      <div class="icon-picker-current" aria-label="Current icon">
        <span class="icon-picker-preview">
          @if (value) {
            <cl-block-icon [icon]="value" />
          } @else {
            <cl-editor-icon name="plus" />
          }
        </span>
        <span>{{ currentLabel }}<small>Bundled SVG icon</small></span>
      </div>
      @if (suggestions.length) {
        <div class="theme-actions" aria-label="Suggested icons">
          @for (icon of suggestions; track icon) {
            <button
              type="button"
              class="button small"
              [attr.aria-label]="'Use ' + icon + ' icon'"
              [attr.aria-pressed]="selected === icon"
              (click)="choose(icon)"
            >
              <cl-block-icon [icon]="icon" />
            </button>
          }
        </div>
      }
      <button
        type="button"
        class="button"
        aria-label="Choose icon"
        aria-haspopup="dialog"
        [attr.aria-expanded]="open"
        (click)="show()"
      >
        Choose icon
      </button>
    </div>
    <cl-ui-surface
      kind="modal"
      label="Choose an icon"
      [open]="open"
      [width]="680"
      panelClass="icon-picker-modal"
      (dismissed)="open = false"
    >
      <header class="editor-dialog-header">
        <span class="editor-dialog-icon"><cl-block-icon icon="icons" /></span>
        <h2>Choose an icon</h2>
        <button
          type="button"
          class="editor-tool"
          aria-label="Close icon picker"
          (click)="open = false"
        >
          <cl-editor-icon name="close" />
        </button>
      </header>
      <div class="icon-picker-body">
        <div class="icon-picker-search">
          <cl-editor-icon name="search" />
          <input
            type="search"
            aria-label="Search icons"
            placeholder="Search icons…"
            autofocus
            [ngModel]="query"
            (ngModelChange)="query = $event"
            (keydown.enter)="$event.preventDefault()"
          />
        </div>
        <p class="icon-picker-count" role="status">
          {{ results.length }} {{ results.length === 1 ? "icon" : "icons" }}
          <span>Current: {{ currentLabel }}</span>
        </p>
        <div class="icon-picker-grid" aria-label="Available icons">
          @for (icon of results; track icon.name) {
            <button
              type="button"
              class="icon-picker-option"
              [attr.data-icon-name]="icon.name"
              [attr.aria-label]="'Select ' + icon.label + ' icon'"
              [attr.aria-pressed]="selected === icon.name"
              (click)="choose(icon.name)"
            >
              <cl-block-icon [icon]="icon.name" /><span>{{ icon.label }}</span>
              @if (selected === icon.name) {
                <cl-editor-icon class="icon-picker-selected" name="check" />
              }
            </button>
          } @empty {
            <p class="icon-picker-empty">
              No icons match “{{ query }}”. Try another name.
            </p>
          }
        </div>
      </div>
      <footer class="editor-dialog-footer">
        <span class="icon-picker-hint">Select an icon to apply it.</span
        ><button
          type="button"
          class="editor-dialog-cancel"
          (click)="open = false"
        >
          Cancel
        </button>
      </footer>
    </cl-ui-surface>
  `,
})
export class IconPickerComponent {
  @Input() value = "star";
  @Input() suggestions: string[] = [];
  @Output() valueChange = new EventEmitter<string>();
  open = false;
  query = "";
  get selected() {
    return iconName(this.value);
  }
  get currentLabel() {
    if (!this.value) return "No icon selected";
    return (
      ICON_CATALOG.find((icon) => icon.name === this.selected)?.label || "Star"
    );
  }
  get results() {
    return searchIcons(this.query);
  }
  show() {
    this.query = "";
    this.open = true;
  }
  choose(name: string) {
    this.open = false;
    this.valueChange.emit(name);
  }
}
