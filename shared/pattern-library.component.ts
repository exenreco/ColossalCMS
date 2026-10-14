import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  effect,
  inject,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { ApiService } from "./api.service";
import { ThemeEditorState } from "./theme-editor-state";
import { PatternRegistry } from "./pattern-registry.service";
import { RegisteredPattern, registerBlockPatterns } from "./block-patterns";
import { ThemeDocument } from "./theme-models";
@Component({
  selector: "cl-pattern-library",
  standalone: true,
  imports: [FormsModule],
  styles: `
    :host {
      display: block;
    }
    .pattern-library {
      padding: 16px;
      display: grid;
      gap: 14px;
    }
    .pattern-library input,
    .pattern-library select {
      width: 100%;
      min-width: 0;
      background: var(--editor-panel);
      color: var(--editor-text);
      border: 1px solid var(--editor-border);
      border-radius: 8px;
      padding: 10px;
      font: inherit;
    }
    .pattern-card {
      display: block;
      width: 100%;
      padding: 0;
      border: 1px solid var(--editor-border);
      border-radius: 10px;
      overflow: hidden;
      background: var(--editor-panel);
      color: var(--editor-text);
      text-align: left;
      cursor: pointer;
    }
    .pattern-card:hover {
      border-color: var(--editor-accent, #56df95);
    }
    .pattern-card:focus-visible {
      outline: 2px solid var(--editor-accent, #56df95);
      outline-offset: 3px;
    }
    .pattern-preview {
      height: 154px;
      position: relative;
      overflow: hidden;
      background: #edf3ef;
    }
    .pattern-preview iframe {
      border: 0;
      width: 720px;
      height: 370px;
      transform: scale(0.42);
      transform-origin: top left;
      pointer-events: none;
    }
    .pattern-meta {
      padding: 12px;
      display: grid;
      gap: 5px;
    }
    .pattern-meta strong {
      font-size: 13px;
    }
    .pattern-meta small,
    .pattern-library p {
      font-size: 12px;
      color: var(--editor-muted);
      margin: 0;
    }
    .pattern-error {
      color: #dd6868 !important;
    }
    .pattern-preview-label {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      font: 12px system-ui;
      color: #52675e;
    }
  `,
  template: `
    @if (open) {
      <section class="pattern-library" aria-label="Pattern library">
        <input
          type="search"
          aria-label="Search patterns"
          placeholder="Search patterns…"
          [(ngModel)]="search"
        />
        <select aria-label="Pattern category" [(ngModel)]="category">
          <option value="">All categories</option>
          @for (c of categories; track c) {
            <option [value]="c">{{ c }}</option>
          }
        </select>
        <p>
          Choose a pattern to add editable blocks. Undo removes the entire
          insertion.
        </p>
        @if (loading) {
          <p role="status">Loading patterns…</p>
        }
        @if (error) {
          <p class="pattern-error" role="alert">{{ error }}</p>
        }
        @for (pattern of filtered; track pattern.key) {
          <button
            type="button"
            class="pattern-card"
            [attr.aria-label]="'Insert pattern: ' + pattern.name"
            [disabled]="!previews[pattern.key]"
            (click)="insert(pattern)"
          >
            <div class="pattern-preview">
              @if (previews[pattern.key]) {
                <iframe
                  [title]="pattern.name + ' preview'"
                  sandbox=""
                  tabindex="-1"
                  loading="lazy"
                  [srcdoc]="previews[pattern.key]"
                ></iframe>
              } @else {
                <span class="pattern-preview-label">{{
                  previewErrors[pattern.key] || "Preparing preview…"
                }}</span>
              }
            </div>
            <span class="pattern-meta"
              ><strong>{{ pattern.name }}</strong
              ><small>{{ pattern.category }} · {{ pattern.source.name }}</small>
              @if (pattern.description) {
                <small>{{ pattern.description }}</small>
              }
            </span>
          </button>
        } @empty {
          @if (!loading) {
            <p>No patterns match your search.</p>
          }
        }
      </section>
    }
  `,
})
export class PatternLibraryComponent implements OnChanges, OnDestroy {
  @Input() open = false;
  @Input() document: ThemeDocument | null = null;
  private api = inject(ApiService);
  private state = inject(ThemeEditorState);
  private registry = inject(PatternRegistry);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  search = "";
  category = "";
  loading = false;
  error = "";
  catalog: RegisteredPattern[] = [];
  previews: Record<string, SafeHtml> = {};
  previewErrors: Record<string, string> = {};
  private loadedFor = "";
  private generation = 0;
  get patterns() {
    const active = new Set(
      this.api
        .state()
        ?.plugins.filter((p) => p.active)
        .map((p) => p.id) || [],
    );
    const currentThemeId =
      this.state.rootLabel === "Main"
        ? this.api.state()?.activeTheme?.manifest.id
        : this.document?.manifest.id;
    const local = this.registry
      .contributions()
      .filter(
        (p) =>
          (p.source.kind !== "plugin" || active.has(p.source.id)) &&
          (p.source.kind !== "theme" || p.source.id === currentThemeId),
      );
    const theme = this.document?.manifest;
    const declarative = theme?.patterns
      ? registerBlockPatterns(
          { id: theme.id, name: theme.name, kind: "theme" },
          theme.patterns,
        )
      : [];
    const combined = [
      ...this.catalog.filter(
        (p) =>
          !(
            theme?.patterns &&
            p.source.kind === "theme" &&
            p.source.id === theme.id
          ),
      ),
      ...declarative,
      ...local,
    ];
    return Array.from(
      new Map(
        combined
          .filter((p) => p.source.kind !== "plugin" || active.has(p.source.id))
          .map((p) => [p.key, p]),
      ).values(),
    );
  }
  get categories() {
    return [...new Set(this.patterns.map((p) => p.category))].sort();
  }
  get filtered() {
    const q = this.search.trim().toLowerCase();
    return this.patterns.filter(
      (p) =>
        (!this.category || p.category === this.category) &&
        (!q ||
          [p.name, p.description, p.category, p.source.name]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
  }
  constructor() {
    effect(() => {
      this.registry.contributions();
      this.api.state();
      this.ensureLoaded();
    });
  }
  ngOnDestroy() {
    this.generation++;
  }
  ngOnChanges() {
    if (!this.open) {
      this.generation++;
      this.loading = false;
      this.loadedFor = "";
      return;
    }
    this.ensureLoaded();
  }
  private ensureLoaded() {
    if (!this.open) return;
    const key = this.document?.manifest.id || "active";
    const signature =
      key +
      JSON.stringify(this.document?.manifest.patterns || []) +
      JSON.stringify(this.registry.contributions()) +
      JSON.stringify(this.api.state()?.plugins.map((p) => [p.id, p.active]));
    if (this.loadedFor !== signature) {
      this.loadedFor = signature;
      void this.load(key);
    }
  }
  async load(key: string) {
    const generation = ++this.generation;
    this.loading = true;
    this.error = "";
    this.previews = {};
    this.previewErrors = {};
    try {
      const result = await this.api.request(
        "/admin/editor/patterns?themeId=" + encodeURIComponent(key),
      );
      if (generation !== this.generation) return;
      this.catalog = result.patterns;
      const queue = [...this.patterns];
      const worker = async () => {
        while (queue.length) {
          const pattern = queue.shift()!;
          try {
            const render = await this.api.request(
              "/admin/editor/patterns/preview",
              "POST",
              { themeId: key, pattern },
            );
            if (generation !== this.generation) return;
            const css = String(render.css || "").replace(/</g, "\\3c ");
            const html =
              '<!doctype html><html><head><meta name="viewport" content="width=720"><style>body{margin:0;padding:20px;font:16px system-ui;background:#ffffff;color:#153d31}' +
              css +
              '</style></head><body class="theme-root">' +
              render.html +
              "</body></html>";
            this.previews[pattern.key] =
              this.sanitizer.bypassSecurityTrustHtml(html);
          } catch {
            if (generation !== this.generation) return;
            this.previewErrors[pattern.key] = "Preview unavailable";
          }
          this.cdr.markForCheck();
        }
      };
      await Promise.all([worker(), worker()]);
    } catch (e) {
      this.error = (e as Error).message;
      this.loadedFor = "";
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }
  insert(pattern: RegisteredPattern) {
    this.state.insertPattern(pattern);
    this.error = this.state.error;
  }
}
