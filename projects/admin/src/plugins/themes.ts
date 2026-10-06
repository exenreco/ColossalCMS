import { Component, inject, OnInit, ChangeDetectorRef } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { ApiService } from "../../../../shared/api.service";
import { IconComponent } from "../../../../shared/icon.component";
import { ThemesListSkeletonComponent } from "../../../../shared/skeleton-compositions";
import { ThemeSummary } from "../../../../shared/theme-models";
@Component({
  selector: "cl-themes",
  standalone: true,
  imports: [
    RouterLink,
    RouterOutlet,
    IconComponent,
    ThemesListSkeletonComponent,
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
              <iframe
                title="Theme thumbnail"
                sandbox=""
                tabindex="-1"
                [srcdoc]="thumbnails[t.id] || ''"
              ></iframe
              ><span class="theme-card-badge">{{
                t.active
                  ? "Active theme"
                  : t.isCore
                    ? "Core theme"
                    : "Ready to make yours"
              }}</span>
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
              <p>{{ t.description }}</p>
              <small
                >By {{ t.author }} · {{ t.templates.length }} templates{{
                  t.hasDraft ? " · Draft saved" : ""
                }}</small
              >
              <div class="theme-card-actions">
                <a class="button primary" [routerLink]="['edit', t.id]"
                  >Edit theme</a
                >
                @if (!t.active) {
                  <button
                    class="button"
                    [disabled]="busy"
                    (click)="activate(t)"
                  >
                    Activate
                  </button>
                }
                <button class="button" (click)="preview(t)">Preview</button
                ><a class="button" [href]="'/api/themes/' + t.id + '/export'"
                  >Export</a
                >
                @if (!t.isCore && !t.active) {
                  <button class="button danger" (click)="remove(t)">
                    Delete
                  </button>
                }
              </div>
            </div>
          </article>
        }
      </div>
      <div class="theme-footnote">
        Themes use shared headers and footers, reusable blocks, and templates
        for pages, posts, search, and archives.
      </div>
    </section>
    <router-outlet (deactivate)="load()" />`,
})
export class ThemesComponent implements OnInit {
  cdr = inject(ChangeDetectorRef);
  api = inject(ApiService);
  sanitizer = inject(DomSanitizer);
  themes: ThemeSummary[] = [];
  thumbnails: Record<string, SafeHtml> = {};
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
                  t.templates.find((x) => x.appliesTo.includes("post-index"))
                    ?.id ||
                  t.templates[0].id,
              },
            );
            this.thumbnails[t.id] = this.sanitizer.bypassSecurityTrustHtml(
              "<style>body{margin:0}" + render.css + "</style>" + render.html,
            );
          } catch {
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
