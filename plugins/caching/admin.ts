import { Component, ChangeDetectorRef, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../shared/api.service";
@Component({
  selector: "cl-caching-admin",
  standalone: true,
  imports: [FormsModule],
  styles: `
    .cache-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: start;
    }
    .cache-fields {
      display: grid;
      gap: 20px;
    }
    .cache-fields label {
      margin: 0;
    }
    .cache-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
    }
    .cache-stats dt {
      font-size: 12px;
      color: var(--muted);
    }
    .cache-stats dd {
      margin: 6px 0 0;
      font-size: 24px;
    }
    .cache-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 20px;
    }
    .cache-fields textarea {
      min-height: 120px;
      width: 100%;
      box-sizing: border-box;
    }
    .cache-fields input[type="number"] {
      max-width: 160px;
    }
    .cache-last {
      margin-top: 20px;
    }
    @media (max-width: 850px) {
      .cache-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">CACHING</p>
        <h1>Faster pages. Fresh content.</h1>
        <p>
          Reuse public page responses instead of rebuilding them on every visit.
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
    <div class="cache-grid">
      <section class="panel">
        <div class="form-content cache-fields">
          <h2>Cache settings</h2>
          <label class="admin-checkbox-row"
            ><input
              type="checkbox"
              [(ngModel)]="settings.enabled"
              [disabled]="loading || busy"
            /><span>Enable public response caching</span></label
          >
          <label class="admin-checkbox-row"
            ><input
              type="checkbox"
              [(ngModel)]="settings.cachePages"
              [disabled]="loading || busy"
            /><span>Cache public page HTML</span></label
          >
          <label class="admin-checkbox-row"
            ><input
              type="checkbox"
              [(ngModel)]="settings.cacheApi"
              [disabled]="loading || busy"
            /><span>Cache public site and theme-render responses</span></label
          >
          <label
            >Cache lifetime (seconds)<input
              type="number"
              min="30"
              max="3600"
              [(ngModel)]="settings.ttl"
              [disabled]="loading || busy"
          /></label>
          <p class="field-note">
            Default: 300 seconds (5 minutes). Content, theme, media, settings,
            and plugin changes automatically invalidate the cache. Scheduled
            publication also expires affected cache entries.
          </p>
          <label
            >Exclude paths<textarea
              [(ngModel)]="excludedPaths"
              [disabled]="loading || busy"
              placeholder="/contact&#10;/members"
            ></textarea>
          </label>
          <p class="field-note">
            One path per line. An exclusion includes its child paths. Admin
            pages, signed-in visitors, requests with cookies, previews,
            searches, private downloads, forms, and other dynamic plugin APIs
            always bypass caching.
          </p>
          <button
            class="button primary"
            [disabled]="loading || busy"
            (click)="save()"
          >
            {{ busy ? "Working…" : "Save cache settings" }}
          </button>
        </div>
      </section>
      <section class="panel">
        <div class="form-content">
          <h2>Cache overview</h2>
          <dl class="cache-stats">
            <div>
              <dt>Stored responses</dt>
              <dd>{{ stats.entries }} / {{ stats.maxEntries }}</dd>
            </div>
            <div>
              <dt>Stored size</dt>
              <dd>{{ size }}</dd>
            </div>
            <div>
              <dt>Hits on this instance</dt>
              <dd>{{ stats.hits }}</dd>
            </div>
            <div>
              <dt>Misses on this instance</dt>
              <dd>{{ stats.misses }}</dd>
            </div>
            <div>
              <dt>Bypasses on this instance</dt>
              <dd>{{ stats.bypasses }}</dd>
            </div>
            <div>
              <dt>Cache errors on this instance</dt>
              <dd>{{ stats.errors }}</dd>
            </div>
          </dl>
          <p class="field-note">
            Responses persist in your configured SQLite, MongoDB, or D1
            database. Warm server instances also keep a bounded memory cache.
            Traffic counters reset when an instance restarts and are not
            site-wide analytics.
          </p>
          <p class="field-note cache-last">
            Last invalidation: <strong>{{ lastPurge }}</strong>
          </p>
          <div class="cache-actions">
            <button
              class="button"
              [disabled]="loading || busy"
              (click)="purge()"
            >
              Purge cache</button
            ><button
              class="button"
              [disabled]="loading || busy"
              (click)="refresh()"
            >
              Refresh statistics
            </button>
          </div>
          <h3>Verify a cache hit</h3>
          <p class="field-note">
            Open a public page twice in a signed-out browser. Its response
            header <code>X-Colossal-Cache</code> changes from
            <code>MISS</code> to <code>HIT</code>. <code>Age</code> shows the
            cached response’s age in seconds. Cache failures fall back to normal
            rendering.
          </p>
          <p class="field-note">
            The cache stores up to 64 responses, each up to 512 KB. No extra
            environment variables or external cache account are required.
            Page-view tracking continues on cached document loads.
          </p>
        </div>
      </section>
    </div>
  `,
})
export class CachingComponent implements OnInit {
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  settings = {
    enabled: true,
    ttl: 300,
    cachePages: true,
    cacheApi: true,
    excludedPaths: [] as string[],
  };
  stats = {
    entries: 0,
    bytes: 0,
    maxEntries: 64,
    hits: 0,
    misses: 0,
    bypasses: 0,
    errors: 0,
    purgedAt: "",
  };
  excludedPaths = "";
  loading = true;
  busy = false;
  error = "";
  notice = "";
  get size() {
    return this.stats.bytes >= 1048576
      ? (this.stats.bytes / 1048576).toFixed(1) + " MB"
      : (this.stats.bytes / 1024).toFixed(1) + " KB";
  }
  get lastPurge() {
    return this.stats.purgedAt
      ? new Date(this.stats.purgedAt).toLocaleString()
      : "No invalidations yet";
  }
  async ngOnInit() {
    await this.refresh(true);
  }
  async refresh(loadSettings = false) {
    this.loading = true;
    this.error = "";
    try {
      const result = await this.api.request("/admin/caching");
      this.stats = result.stats;
      if (loadSettings) {
        this.settings = result.settings;
        this.excludedPaths = this.settings.excludedPaths.join("\n");
      }
    } catch (error) {
      this.error = (error as Error).message;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  async save() {
    await this.run(async () => {
      await this.api.request("/admin/caching", "POST", {
        ...this.settings,
        excludedPaths: this.excludedPaths
          .split(/\r?\n/)
          .map((path) => path.trim())
          .filter(Boolean),
      });
      this.notice = "Cache settings saved. Cached responses were cleared.";
      await this.refresh(true);
    });
  }
  async purge() {
    await this.run(async () => {
      await this.api.request("/admin/caching/purge", "POST", {});
      this.notice = "Cached responses cleared.";
      await this.refresh();
    });
  }
  private async run(action: () => Promise<void>) {
    this.busy = true;
    this.error = "";
    this.notice = "";
    try {
      await action();
    } catch (error) {
      this.error = (error as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
