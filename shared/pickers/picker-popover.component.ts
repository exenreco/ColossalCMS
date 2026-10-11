import { Component, ElementRef, Input, ViewChild } from "@angular/core";
import { UiSurfaceComponent } from "../ui-surface.component";
import { EditorIconComponent } from "../editor-icon.component";
/** Pickers share the same top-layer surface as editor menus and dialogs. */
@Component({
  selector: "cl-picker-popover",
  standalone: true,
  imports: [UiSurfaceComponent, EditorIconComponent],
  template: `
    <button
      #trigger
      type="button"
      class="cl-picker-trigger"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open"
      [attr.aria-label]="label"
      (click)="open = !open"
    >
      <span
        class="cl-picker-badge"
        [class.cl-color-badge]="!!swatch"
        [style.background]="swatch || null"
        >{{ swatch ? "" : badge }}</span
      ><span>{{ label }}</span
      ><cl-editor-icon class="cl-picker-chevron" name="chevron" />
    </button>
    <cl-ui-surface
      [open]="open"
      [anchor]="trigger"
      [label]="label + ' picker'"
      panelClass="cl-picker-popover"
      placement="side"
      [width]="340"
      (dismissed)="open = false"
      ><div class="cl-picker-popover-heading">
        <strong>{{ label }}</strong
        ><button
          type="button"
          aria-label="Close {{ label }} picker"
          (click)="open = false"
        >
          <cl-editor-icon name="close" />
        </button>
      </div>
      <ng-content
    /></cl-ui-surface>
  `,
})
export class PickerPopoverComponent {
  @Input() label = "Picker";
  @Input() badge = "";
  @Input() swatch = "";
  @ViewChild("trigger") trigger!: ElementRef<HTMLButtonElement>;
  open = false;
  close(restoreFocus = false) {
    this.open = false;
    if (restoreFocus) this.trigger.nativeElement.focus();
  }
}
