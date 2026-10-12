import { Component, inject, effect } from "@angular/core";
import { MediaSelectionService } from "./media-selection.service";
import { MediaLibraryComponent } from "./media-library.component";
import { UiSurfaceComponent } from "./ui-surface.component";
import { IconComponent } from "./icon.component";
import { MediaItem } from "./models";
import { ApiService } from "./api.service";
import { AdminAppearanceService } from "./admin-appearance.service";
@Component({
  selector: "cl-media-picker",
  standalone: true,
  imports: [MediaLibraryComponent, UiSurfaceComponent, IconComponent],
  template: `@if (selection.options(); as options) {
    <cl-ui-surface
      kind="modal"
      panelClass="media-picker-dialog"
      label="Choose your media"
      [open]="true"
      [width]="1120"
      [colorMode]="colorMode"
      (dismissed)="selection.close()"
    >
      <div class="modal-heading">
        <div>
          <p class="eyebrow">FROM YOUR LIBRARY</p>
          <h2 id="picker-title">Choose your media</h2>
        </div>
        <button
          class="icon-button"
          aria-label="Close media picker"
          (click)="selection.close()"
        >
          <cl-icon name="close" />
        </button>
      </div>
      <div class="media-picker-body">
        <cl-media-library
          [picker]="true"
          [accept]="options.accept || []"
          [multiple]="options.multiple || false"
          [selectedIds]="initialIds"
          (selectionChange)="items = $event"
        />
      </div>
      <div class="modal-footer">
        <span class="muted">{{ items.length }} selected</span
        ><button class="button" (click)="selection.close()">Cancel</button
        ><button
          class="button primary"
          [disabled]="!items.length"
          (click)="selection.close(items)"
        >
          Use selected
        </button>
      </div>
    </cl-ui-surface>
  }`,
})
export class MediaPickerComponent {
  selection = inject(MediaSelectionService);
  api = inject(ApiService);
  appearance = inject(AdminAppearanceService);
  get colorMode(): "light" | "dark" {
    return this.appearance.colorMode();
  }
  items: MediaItem[] = [];
  initialIds: string[] = [];
  constructor() {
    effect(() => {
      const options = this.selection.options();
      this.initialIds = options?.initialSelectionIds || [];
      this.items = (this.api.state()?.media || []).filter(
        (m) =>
          this.initialIds.includes(m.id) &&
          (!options?.accept || options.accept.includes(m.type)),
      );
    });
  }
}
