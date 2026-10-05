import { Component, inject, effect } from "@angular/core";
import { MediaSelectionService } from "./media-selection.service";
import { MediaLibraryComponent } from "./media-library.component";
import { DialogFocusDirective } from "./dialog-focus.directive";
import { IconComponent } from "./icon.component";
import { MediaItem } from "./models";
import { ApiService } from "./api.service";
@Component({
  selector: "cl-media-picker",
  standalone: true,
  imports: [MediaLibraryComponent, DialogFocusDirective, IconComponent],
  template: `@if (selection.options(); as options) {
    <div class="modal-overlay media-picker-layer">
      <section
        class="media-picker-dialog"
        clDialogFocus
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
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
      </section>
    </div>
  }`,
})
export class MediaPickerComponent {
  selection = inject(MediaSelectionService);
  api = inject(ApiService);
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
