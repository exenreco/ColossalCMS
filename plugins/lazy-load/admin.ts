import { ChangeDetectorRef, Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../shared/api.service";

@Component({
  selector: "cl-lazy-load-admin",
  standalone: true,
  imports: [FormsModule],
  styles: `
    .lazy-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: start;
    }
    .lazy-fields {
      display: grid;
      gap: 20px;
    }
    .lazy-fields label {
      margin: 0;
    }
    .lazy-preview {
      min-height: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
    }
    .lazy-spinner {
      display: block;
      box-sizing: border-box;
      border: 3px solid transparent;
      border-top-color: currentColor;
      border-right-color: currentColor;
      border-radius: 50%;
      animation: lazy-spin 0.8s linear infinite;
    }
    @keyframes lazy-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .lazy-spinner {
        animation: none;
      }
    }
    @media (max-width: 800px) {
      .lazy-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">LAZY LOAD</p>
        <h1>Images, ready when needed.</h1>
        <p>
          Load images as visitors approach them and show a spinner while they
          load.
        </p>
      </div>
      <a class="button" href="/" target="_blank" rel="noopener">Visit site ↗</a>
    </div>
    @if (error) {
      <p class="notice" role="alert">{{ error }}</p>
    }
    @if (notice) {
      <p class="notice" role="status">{{ notice }}</p>
    }
    <div class="lazy-grid">
      <section class="panel">
        <div class="form-content lazy-fields">
          <h2>Image loading</h2>
          <label class="admin-checkbox-row"
            ><input type="checkbox" [(ngModel)]="settings.enabled" /><span
              >Enable lazy loading and image spinners</span
            ></label
          >
          <label class="admin-checkbox-row"
            ><input
              type="checkbox"
              [(ngModel)]="settings.skipFirstImage"
            /><span>Prioritize the first content image</span></label
          >
          <p class="field-note">
            Logos, header images, 3D scene artwork and images explicitly marked
            eager or high priority keep their existing loading behavior. Theme
            previews and editor canvases are unaffected.
          </p>
          <label
            >Spinner color<input
              aria-label="Spinner color"
              type="text"
              maxlength="7"
              placeholder="#56df95"
              [(ngModel)]="settings.spinnerColor"
          /></label>
          <label
            >Spinner size (px)<input
              aria-label="Spinner size"
              type="number"
              min="16"
              max="64"
              [(ngModel)]="settings.spinnerSize"
          /></label>
          <button
            class="button primary"
            [disabled]="busy || loading"
            (click)="save()"
          >
            {{ busy ? "Saving…" : "Save Lazy Load settings" }}
          </button>
        </div>
      </section>
      <section class="panel">
        <div class="form-content">
          <h2>Spinner preview</h2>
          <div class="lazy-preview" aria-label="Image loading spinner preview">
            <span
              class="lazy-spinner"
              [style.color]="settings.spinnerColor"
              [style.width.px]="settings.spinnerSize"
              [style.height.px]="settings.spinnerSize"
            ></span>
          </div>
          <p class="field-note">
            The spinner disappears when an image loads or fails. Existing image
            dimensions and responsive picture sources are preserved.
            Reduced-motion preferences use a static indicator.
          </p>
          <h3>Exclude an image</h3>
          <p class="field-note">
            Add the CSS class <code>no-lazy</code> to an image block or its
            parent in Advanced settings to keep the original behavior. Use
            <code>loading="eager"</code> when an image should load immediately
            but still show a spinner.
          </p>
        </div>
      </section>
    </div>
  `,
})
export class LazyLoadComponent implements OnInit {
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  settings = {
    enabled: true,
    spinnerColor: "#56df95",
    spinnerSize: 28,
    skipFirstImage: true,
  };
  busy = false;
  loading = true;
  error = "";
  notice = "";
  async ngOnInit() {
    try {
      this.settings = await this.api.request("/admin/lazy-load");
    } catch (error) {
      this.error = (error as Error).message;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  async save() {
    this.busy = true;
    this.error = "";
    this.notice = "";
    try {
      await this.api.request("/admin/lazy-load", "POST", this.settings);
      this.notice = "Lazy Load settings saved.";
    } catch (error) {
      this.error = (error as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
