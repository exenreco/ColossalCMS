import { Component, Input, inject } from "@angular/core";
import { IconComponent } from "../../../shared/icon.component";
import { UiSurfaceComponent } from "../../../shared/ui-surface.component";
import { ContentTableKind, ContentTableState } from "./content-table-state";
@Component({
  selector: "cl-screen-options",
  standalone: true,
  imports: [IconComponent, UiSurfaceComponent],
  template: `<button
      #trigger
      type="button"
      class="button subtle screen-options-trigger"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open"
      (click)="open = !open"
    >
      Screen options <cl-icon name="chevron" />
    </button>
    <cl-ui-surface
      [open]="open"
      [anchor]="trigger"
      [arrow]="true"
      [width]="240"
      label="Screen options"
      panelClass="admin-screen-options"
      (dismissed)="open = false"
    >
      <fieldset>
        <legend>Table columns</legend>
        @for (
          column of columns.options(kind, seoEnabled);
          track column.key;
          let i = $index
        ) {
          <label
            ><input
              type="checkbox"
              [checked]="columns.visible(kind, column.key)"
              [disabled]="column.required || false"
              [attr.autofocus]="i === 1 ? '' : null"
              (change)="
                columns.setVisible(
                  kind,
                  column.key,
                  $any($event.target).checked
                )
              "
            />
            <span
              >{{ column.label }}
              @if (column.required) {
                <small>Always shown</small>
              }
            </span>
          </label>
        }
      </fieldset>
    </cl-ui-surface>`,
})
export class ScreenOptionsComponent {
  @Input() kind: ContentTableKind = "page";
  @Input() seoEnabled = false;
  columns = inject(ContentTableState);
  open = false;
}
