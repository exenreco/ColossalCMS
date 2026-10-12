import { Component, inject, OnInit, ChangeDetectorRef } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { ApiService } from "../../../../shared/api.service";
import { IconComponent } from "../../../../shared/icon.component";
import { ThemesListSkeletonComponent } from "../../../../shared/skeleton-compositions";
import { AdminModalComponent } from "../../../../shared/admin-modal.component";
import { ThemeSummary } from "../../../../shared/theme-models";
import { themeBodyAttributes } from "../../../../shared/theme-body";
@Component({
  selector: "cl-themes",
  standalone: true,
  imports: [
    RouterLink,
    RouterOutlet,
    IconComponent,
    ThemesListSkeletonComponent,
    AdminModalComponent,
  ],
  template: ` <section class="theme-management">
      <div class="page-heading">
        <div>
          <p class="eyebrow">MAKE IT YOURS</p>
          <h1>Themes</h1>
          <p>A home for your content. Shape every page, one block at a time.</p>
        </div>
        <div class="theme-actions">
          <button class="button" [disabled]="busy" (click)="create()">
            + New theme</button
          ><button
            class="button primary"
            [disabled]="busy"
            (click)="upload.click()"
          >
            Install theme ZIP</button
          ><input
            #upload
            hidden
            type="file"
            accept=".zip"
            (change)="install($event)"
          />
        </div>
      </div>
      @if (error) {
        <p class="error-message" role="alert">{{ error }}</p>
      }
      @if (busy) {
        <p role="status">
          {{ progress ? "Uploading " + progress + "%" : "Working…" }}
        </p>
      }
      @if (report.length) {
        <div class="theme-report" role="status">
          <strong>Theme installed. Activate it when you’re ready.</strong>
          @for (item of report; track $index) {
            <p>{{ item }}</p>
          }
        </div>
      }
      @if (loading) {
        <cl-themes-list-skeleton />
      }
      <div class="theme-card-grid">
        @for (t of themes; track t.id) {
          <article class="theme-card" [class.active]="t.active">
            <div class="theme-thumbnail">
              @if (thumbnailErrors[t.id]) {
                <p class="theme-thumbnail-error" role="status">
                  {{ thumbnailErrors[t.id] }}
                </p>
              } @else {
                <iframe
                  [title]="t.name + ' theme preview'"
                  sandbox=""
                  tabindex="-1"
                  [srcdoc]="thumbnails[t.id] || ''"
                ></iframe>
              }
              <span class="theme-card-badge">{{
                t.active
                  ? "Active theme"
                  : t.isCore
                    ? "Core theme"
                    : "Ready to make yours"
              }}</span>
              <div class="theme-preview-overlay">
                <button
                  type="button"
                  class="theme-details-trigger"
                  [attr.aria-label]="'Theme details for ' + t.name"
                  (click)="detailId = t.id"
                >
                  <span>Theme details</span>
                </button>
                <div class="theme-preview-actions">
                  @if (!t.active) {
                    <button
                      type="button"
                      class="icon-button"
                      [disabled]="busy"
                      [attr.aria-label]="'Activate ' + t.name"
                      title="Activate theme"
                      (click)="activate(t)"
                    >
                      <cl-icon name="check" /><span>Activate</span>
                    </button>
                  }
                  <button
                    type="button"
                    class="icon-button"
                    [disabled]="busy"
                    [attr.aria-label]="'Preview ' + t.name"
                    title="Preview theme"
                    (click)="preview(t)"
                  >
                    <cl-icon name="eye" /><span>Preview</span>
                  </button>
                </div>
              </div>
            </div>
            <div class="theme-card-body">
              <div class="theme-card-title">
                <h2>
                  @if (t.isCore) {
                    <cl-icon name="lock" />
                  }
                  {{ t.name }}
                </h2>
                <span>v{{ t.version }}</span>
              </div>
              <small
                >By {{ t.author }} · {{ t.templates.length }} templates{{
                  t.hasDraft ? " · Draft saved" : ""
                }}</small
              >
            </div>
          </article>
        }
      </div>
      <div class="theme-footnote">
        Themes use shared headers and footers, reusable blocks, and templates
        for pages, posts, search, and archives.
      </div>
    </section>
    @if (detail; as t) {
      <cl-admin-modal
        [title]="t.name"
        icon="themes"
        description="Theme details"
        [busy]="busy"
        [width]="640"
        (dismissed)="detailId = ''"
      >
        <div class="theme-details-content">
          <div class="theme-thumbnail theme-details-preview">
            @if (thumbnailErrors[t.id]) {
              <p class="theme-thumbnail-error" role="status">
                {{ thumbnailErrors[t.id] }}
              </p>
            } @else {
              <iframe
                [title]="t.name + ' theme preview'"
                sandbox=""
                tabindex="-1"
                [srcdoc]="thumbnails[t.id] || ''"
              ></iframe>
            }
          </div>
          <p class="theme-details-description">{{ t.description }}</p>
          <dl class="theme-details-meta">
            <dt>Version</dt>
            <dd>{{ t.version }}</dd>
            <dt>Author</dt>
            <dd>{{ t.author }}</dd>
            <dt>Templates</dt>
            <dd>{{ t.templates.length }}</dd>
            <dt>Status</dt>
            <dd>
              {{ t.active ? "Active theme" : "Inactive"
              }}{{ t.isCore ? " · Core theme" : ""
              }}{{ t.hasDraft ? " · Draft saved" : "" }}
            </dd>
          </dl>
          @if (error) {
            <p class="error-message" role="alert">{{ error }}</p>
          }
          <div class="theme-card-actions theme-details-actions">
            <a
              class="button primary"
              [routerLink]="['edit', t.id]"
              (click)="detailId = ''"
              ><cl-icon name="edit-square" />Edit theme</a
            >
            @if (!t.active) {
              <button
                type="button"
                class="button"
                [disabled]="busy"
                (click)="activate(t)"
              >
                <cl-icon name="check" />Activate
              </button>
            }
            <button
              type="button"
              class="button"
              [disabled]="busy"
              (click)="preview(t)"
            >
              <cl-icon name="eye" />Preview
            </button>
            <a class="button" [href]="'/api/themes/' + t.id + '/export'"
              ><cl-icon name="download" />Export</a
            >
            @if (!t.isCore && !t.active) {
              <button
                type="button"
                class="button danger"
                [disabled]="busy"
                (click)="remove(t)"
              >
                <cl-icon name="trash" />Delete
              </button>
            }
          </div>
        </div>
      </cl-admin-modal>
    }
    <router-outlet (deactivate)="load()" />`,
})
export class ThemesComponent implements OnInit {
  cdr = inject(ChangeDetectorRef);
  api = inject(ApiService);
  sanitizer = inject(DomSanitizer);
  themes: ThemeSummary[] = [];
  thumbnails: Record<string, SafeHtml> = {};
  thumbnailErrors: Record<string, string> = {};
  detailId = "";
  get detail() {
    return this.themes.find((t) => t.id === this.detailId);
  }
  error = "";
  busy = false;
  loading = true;
  progress = 0;
  report: string[] = [];
  ngOnInit() {
    this.load();
  }
  async load() {
    try {
      this.loading = true;
      this.thumbnailErrors = {};
      this.themes = await this.api.request("/themes");
      this.cdr.markForCheck();
      await Promise.all(
        this.themes.map(async (t) => {
          try {
            const record = await this.api.request("/themes/" + t.id);
            const render = await this.api.request(
              "/themes/" + t.id + "/render",
              "POST",
              {
                document: record.published,
                templateId:
                  record.published.manifest.homeTemplate ||
                  t.templates.find((x) => x.appliesTo.includes("home"))?.id ||
                  t.templates.find((x) => x.appliesTo.includes("post-index"))
                    ?.id ||
                  t.templates[0].id,
              },
            );
            this.thumbnails[t.id] = this.sanitizer.bypassSecurityTrustHtml(
              '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}html,body{min-height:100%;overflow:hidden}' +
                render.css.replace(/</g, "\\3c ") +
                "</style></head><body " +
                themeBodyAttributes(render.body) +
                ">" +
                render.html +
                "</body></html>",
            );
          } catch (e) {
            this.thumbnailErrors[t.id] =
              "Preview unavailable: " + (e as Error).message;
          } finally {
            this.cdr.markForCheck();
          }
        }),
      );
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  async action(fn: () => Promise<void>) {
    this.busy = true;
    this.error = "";
    try {
      await fn();
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
  async install(e: Event) {
    const input = e.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    await this.action(async () => {
      const form = new FormData();
      form.set("file", file);
      const r = await this.api.upload("/themes/install", form, (p) => {
        this.progress = p;
        this.cdr.markForCheck();
      });
      this.report = r.report.length
        ? r.report
        : ["All theme files passed validation."];
      await this.load();
    });
    input.value = "";
    this.progress = 0;
  }
  async activate(t: ThemeSummary) {
    const missing = this.api
      .state()!
      .content.filter(
        (c) =>
          c.templateId &&
          !t.templates.some(
            (x) => x.id === c.templateId && x.appliesTo.includes(c.kind),
          ),
      );
    if (
      !confirm(
        "Activate " +
          t.name +
          "?" +
          (missing.length
            ? " These entries will use a fallback template: " +
              missing.map((c) => c.title).join(", ") +
              "."
            : ""),
      )
    )
      return;
    await this.action(async () => {
      const r = await this.api.request(
        "/themes/" + t.id + "/activate",
        "POST",
        { revision: t.revision },
      );
      await this.api.load();
      await this.load();
      this.api.toast(
        "Theme activated" +
          (r.fallbacks.length
            ? " · " + r.fallbacks.length + " entries use fallback templates."
            : "."),
      );
    });
  }
  async preview(t: ThemeSummary) {
    await this.action(async () => {
      const r = await this.api.request("/themes/" + t.id + "/preview", "POST", {
        draft: false,
      });
      window.open(r.url, "_blank", "noopener");
    });
  }
  async create() {
    const name = prompt("Name your new theme", "My theme");
    if (!name) return;
    await this.action(async () => {
      const core = this.themes.find((t) => t.isCore)!;
      await this.api.request("/themes/" + core.id + "/clone", "POST", {
        name,
        revision: core.revision,
      });
      await this.load();
    });
  }
  async remove(t: ThemeSummary) {
    if (!confirm("Delete " + t.name + " and its saved versions?")) return;
    await this.action(async () => {
      await this.api.request("/themes/" + t.id, "DELETE", {});
      await this.load();
    });
  }
}
