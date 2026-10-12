import { ChangeDetectorRef, Component, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink, RouterOutlet } from "@angular/router";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { ApiService } from "../../../../shared/api.service";
import { IconComponent } from "../../../../shared/icon.component";
import { AdminModalComponent } from "../../../../shared/admin-modal.component";
import { ThemeSummary } from "../../../../shared/theme-models";
import { ThemesListSkeletonComponent } from "../../../../shared/skeleton-compositions";
import { themeBodyAttributes } from "../../../../shared/theme-body";
import { MaintenanceState } from "../maintenance-state";

@Component({
  selector: "cl-maintenance",
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    RouterOutlet,
    ThemesListSkeletonComponent,
    IconComponent,
    AdminModalComponent,
  ],
  styles: `
    .maintenance-settings {
      padding: 24px;
      margin-bottom: 24px;
    }
    .maintenance-settings h2 {
      margin-bottom: 12px;
    }
    .maintenance-views {
      display: block;
      margin-top: 8px;
    }
    .maintenance-controls {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 20px;
      margin: 20px 0;
    }
    .maintenance-controls label {
      display: grid;
      gap: 8px;
      font-size: 13px;
    }
    .maintenance-controls select {
      max-width: 260px;
    }
    .maintenance-controls select,
    .maintenance-controls input[type="number"] {
      padding: 10px 12px;
      border: 1px solid #d7dde6;
      border-radius: 8px;
      background: white;
      color: #182238;
      font: inherit;
    }
    .maintenance-controls input[type="number"] {
      width: 160px;
    }
  `,
  template: `
    <section class="theme-management">
      <div class="page-heading">
        <div>
          <p class="eyebrow">A LITTLE TIME TO MAKE IT BETTER</p>
          <h1>Maintenance</h1>
          <p>
            Give visitors a thoughtful landing page while you work on your site.
          </p>
        </div>
        <button
          class="button primary"
          [disabled]="busy || loading"
          (click)="create()"
        >
          + New layout
        </button>
      </div>
      @if (error) {
        <p class="error" role="alert">{{ error }}</p>
      }
      @if (loading) {
        <cl-themes-list-skeleton />
      }
      @if (!loading) {
        <form class="panel maintenance-settings" (ngSubmit)="saveSettings()">
          <h2>Maintenance mode</h2>
          <p>
            Visitors receive the selected published template with HTTP 503.
            Administrators can browse the normal site and keep editing. Drafts
            stay private until published.
          </p>
          <div class="maintenance-controls">
            <label
              >Published layout<select
                name="layout"
                [ngModel]="settings.layoutId"
                (ngModelChange)="selectLayout($event)"
              >
                @for (l of layouts; track l.id) {
                  <option [value]="l.id">{{ l.name }}</option>
                }
              </select></label
            >
            <label
              >Published template<select
                name="template"
                [(ngModel)]="settings.templateId"
              >
                @for (t of selectedLayout?.templates || []; track t.id) {
                  <option [value]="t.id">{{ t.name }}</option>
                }
              </select></label
            >
            <label
              >Retry after (seconds)<input
                name="retry"
                type="number"
                min="60"
                max="86400"
                [(ngModel)]="settings.retryAfter"
            /></label>
            <button class="button primary" [disabled]="busy">
              {{ busy ? "Saving…" : "Save maintenance settings" }}
            </button>
          </div>
          <small
            >Use the Maintenance On/Off switch beside View site to change mode
            immediately. Save these settings to change the published layout and
            retry timing. Login, setup, admin, health checks, cron jobs, and
            static/media assets remain available. Deactivating the plugin turns
            maintenance off without deleting layouts.</small
          >
        </form>
      }
      <div class="theme-card-grid">
        @for (l of layouts; track l.id) {
          <article class="theme-card" [class.active]="l.active">
            <div class="theme-thumbnail">
              <iframe
                [title]="l.name + ' layout preview'"
                sandbox=""
                tabindex="-1"
                [srcdoc]="thumbnails[l.id] || ''"
              ></iframe
              ><span class="theme-card-badge">{{
                l.active ? "Selected layout" : "Maintenance layout"
              }}</span>
              <div class="theme-preview-overlay">
                <button
                  type="button"
                  class="theme-details-trigger"
                  [attr.aria-label]="'Layout details for ' + l.name"
                  (click)="detailId = l.id"
                >
                  <span>Layout details</span>
                </button>
                <div class="theme-preview-actions">
                  @if (!l.active) {
                    <button
                      type="button"
                      class="icon-button"
                      [disabled]="busy"
                      [attr.aria-label]="'Use ' + l.name + ' layout'"
                      title="Use layout"
                      (click)="use(l)"
                    >
                      <cl-icon name="check" /><span>Use layout</span>
                    </button>
                  }
                  <a
                    class="icon-button"
                    [href]="'/api/maintenance/' + l.id + '/preview'"
                    target="_blank"
                    rel="noopener"
                    [attr.aria-label]="'Preview ' + l.name"
                    title="Preview layout"
                    ><cl-icon name="eye" /><span>Preview</span></a
                  >
                </div>
              </div>
            </div>
            <div class="theme-card-body">
              <div class="theme-card-title">
                <h2>{{ l.name }}</h2>
                <span>{{ l.templates.length }} templates</span>
              </div>
              <small
                >{{ l.hasDraft ? "Draft saved · " : "" }}Edit with the full
                block editor and Inspector.</small
              >
              <small class="maintenance-views"
                >{{ views[l.id] || 0 }} views · last 30 days</small
              >
            </div>
          </article>
        }
      </div>
      <p class="theme-footnote">
        Start with Quiet, Midnight, or Studio. Create blank layouts, add
        templates in the editor, or save an edited layout as a copy.
      </p>
    </section>
    @if (detail; as l) {
      <cl-admin-modal
        [title]="l.name"
        icon="themes"
        description="Maintenance layout details"
        [busy]="busy"
        [width]="640"
        (dismissed)="detailId = ''"
      >
        <div class="theme-details-content">
          <div class="theme-thumbnail theme-details-preview">
            <iframe
              [title]="l.name + ' layout preview'"
              sandbox=""
              tabindex="-1"
              [srcdoc]="thumbnails[l.id] || ''"
            ></iframe>
          </div>
          <p class="theme-details-description">{{ l.description }}</p>
          <dl class="theme-details-meta">
            <dt>Version</dt>
            <dd>{{ l.version }}</dd>
            <dt>Author</dt>
            <dd>{{ l.author }}</dd>
            <dt>Templates</dt>
            <dd>{{ l.templates.length }}</dd>
            <dt>Status</dt>
            <dd>
              {{ l.active ? "Selected layout" : "Available layout"
              }}{{ l.hasDraft ? " · Draft saved" : "" }}
            </dd>
            <dt>Views · last 30 days</dt>
            <dd>{{ views[l.id] || 0 }}</dd>
          </dl>
          @if (error) {
            <p class="error" role="alert">{{ error }}</p>
          }
          <div class="theme-card-actions theme-details-actions">
            <a
              class="button primary"
              [routerLink]="['edit', l.id]"
              (click)="detailId = ''"
              ><cl-icon name="edit-square" />Edit layout</a
            >
            @if (!l.active) {
              <button
                type="button"
                class="button"
                [disabled]="busy"
                (click)="use(l)"
              >
                <cl-icon name="check" />Use layout
              </button>
            }
            <a
              class="button"
              [href]="'/api/maintenance/' + l.id + '/preview'"
              target="_blank"
              rel="noopener"
              ><cl-icon name="eye" />Preview</a
            >
            @if (!l.active) {
              <button
                type="button"
                class="button danger"
                [disabled]="busy"
                (click)="remove(l)"
              >
                <cl-icon name="trash" />Delete
              </button>
            }
          </div>
        </div>
      </cl-admin-modal>
    }
    <router-outlet (deactivate)="load()" />
  `,
})
export class MaintenanceComponent implements OnInit {
  maintenance = inject(MaintenanceState);
  api = inject(ApiService);
  cdr = inject(ChangeDetectorRef);
  sanitizer = inject(DomSanitizer);
  router = inject(Router);
  layouts: ThemeSummary[] = [];
  thumbnails: Record<string, SafeHtml> = {};
  views: Record<string, number> = {};
  settings = {
    enabled: false,
    layoutId: "",
    templateId: "home",
    retryAfter: 3600,
  };
  revision = 0;
  loading = true;
  busy = false;
  detailId = "";
  get detail() {
    return this.layouts.find((l) => l.id === this.detailId);
  }
  error = "";
  get selectedLayout() {
    return this.layouts.find((l) => l.id === this.settings.layoutId);
  }
  ngOnInit() {
    this.load();
  }
  async load() {
    this.loading = true;
    try {
      const data = await this.maintenance.load();
      this.layouts = data.layouts;
      this.settings = data.settings;
      this.revision = data.revision;
      const analytics = await this.api.request(
        "/admin/analytics/views?type=maintenance",
      );
      this.views = analytics.counts;
      await Promise.all(
        this.layouts.map(async (l) => {
          const record = await this.api.request("/maintenance/" + l.id);
          const r = await this.api.request(
            "/maintenance/" + l.id + "/render",
            "POST",
            { document: record.published, templateId: record.templates[0].id },
          );
          this.thumbnails[l.id] = this.sanitizer.bypassSecurityTrustHtml(
            `<style>body{margin:0}${r.css.replace(/</g, "\\3c ")}</style><body ${themeBodyAttributes(r.body)}>${r.html}</body>`,
          );
        }),
      );
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  async run(fn: () => Promise<void>) {
    if (this.busy) return;
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
  selectLayout(id: string) {
    this.settings.layoutId = id;
    this.settings.templateId =
      this.selectedLayout?.templates.find((t) => t.isDefault)?.id || "home";
  }
  async saveSettings() {
    await this.run(async () => {
      await this.api.request("/maintenance/settings", "POST", {
        ...this.settings,
        enabled: this.maintenance.data().settings.enabled,
        revision: this.maintenance.data().revision,
      });
      await this.load();
      this.api.toast("Maintenance settings saved.");
    });
  }
  async use(l: ThemeSummary) {
    this.selectLayout(l.id);
    await this.saveSettings();
  }
  async create() {
    const name = prompt(
      "Name the new maintenance layout",
      "New maintenance layout",
    );
    if (!name) return;
    await this.run(async () => {
      const r = await this.api.request("/maintenance", "POST", { name });
      await this.load();
      await this.router.navigate(["/maintenance/edit", r.id]);
    });
  }
  async remove(l: ThemeSummary) {
    if (!confirm(`Delete ${l.name} and its saved drafts/history?`)) return;
    await this.run(async () => {
      await this.api.request("/maintenance/" + l.id, "DELETE", {});
      await this.load();
    });
  }
}
