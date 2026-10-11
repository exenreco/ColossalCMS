import { Component, EventEmitter, Input, Output, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "./api.service";
import { UiSurfaceComponent } from "./ui-surface.component";

@Component({
  selector: "cl-menu-page-picker",
  standalone: true,
  imports: [FormsModule, UiSurfaceComponent],
  template: `
    <div class="theme-actions">
      <span>{{ currentPage || "Custom link" }}</span>
      <button
        type="button"
        class="button small"
        (click)="open = true; query = ''"
      >
        Choose site page
      </button>
      @if (value) {
        <button
          type="button"
          class="button small"
          (click)="valueChange.emit('')"
        >
          Use custom link
        </button>
      }
    </div>
    <cl-ui-surface
      [open]="open"
      kind="modal"
      label="Choose menu item page"
      [width]="520"
      (dismissed)="open = false"
    >
      <header class="editor-dialog-header">
        <h2>Choose site page</h2>
        <button
          type="button"
          aria-label="Close page picker"
          (click)="open = false"
        >
          ×
        </button>
      </header>
      <div class="editor-dialog-body">
        <input
          aria-label="Find site pages"
          placeholder="Search pages by title or URL…"
          [(ngModel)]="query"
          autofocus
        />
        <div class="menu-page-results">
          @for (page of pages; track page.id) {
            <button type="button" class="button" (click)="choose(page.id)">
              {{ page.title }}
              <small>/{{ page.slug }} · {{ page.status }}</small>
            </button>
          } @empty {
            <p>No matching pages.</p>
          }
        </div>
        <p>
          Unpublished pages appear in navigation after publication. Leave the
          item label empty to use the page title.
        </p>
      </div>
    </cl-ui-surface>
  `,
  styles: [
    `
      .menu-page-results {
        display: grid;
        gap: 8px;
        margin-top: 12px;
        max-height: 350px;
        overflow: auto;
      }
      .menu-page-results button {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      }
      .menu-page-results small {
        opacity: 0.65;
      }
      :host {
        display: block;
      }
    `,
  ],
})
export class MenuPagePickerComponent {
  @Input() value = "";
  @Output() valueChange = new EventEmitter<string>();
  private api = inject(ApiService);
  open = false;
  query = "";
  get currentPage() {
    return this.value
      ? this.api.state()?.content.find((p) => p.id === this.value)?.title ||
          "Missing page"
      : "";
  }
  get pages() {
    const query = this.query.toLowerCase().trim();
    return (this.api.state()?.content || []).filter(
      (p) =>
        p.kind === "page" &&
        (p.title + " " + p.slug).toLowerCase().includes(query),
    );
  }
  choose(id: string) {
    this.valueChange.emit(id);
    this.open = false;
  }
}
