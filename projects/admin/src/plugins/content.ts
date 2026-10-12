import { Component, inject, OnInit } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterOutlet } from "@angular/router";
import { ApiService } from "../../../../shared/api.service";
import { IconComponent } from "../../../../shared/icon.component";
import { DialogFocusDirective } from "../../../../shared/dialog-focus.directive";
import { Content } from "../../../../shared/models";
import { analyzeSeo } from "../../../../shared/seo";
@Component({
  selector: "cl-content",
  standalone: true,
  styles: `
    .seo-score-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border: 0;
      border-radius: 999px;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
    }
    .seo-score-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pillar-content-icon {
      display: inline-flex;
      align-items: center;
      color: var(--accent, #246b50);
    }
    .seo-score-badge.poor {
      background: #fee2e2;
      color: #991b1b;
    }
    .seo-score-badge.fair {
      background: #ffedd5;
      color: #9a3412;
    }
    .seo-score-badge.good {
      background: #dcfce7;
      color: #166534;
    }
    .seo-score-badge:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 3px;
    }
    .content-title-cell {
      min-width: 280px;
      position: relative;
      padding-bottom: 28px;
    }
    .title-inline-menu {
      position: absolute;
      left: 48px;
      bottom: 0;
      height: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.12s;
    }
    .content-title-cell:hover .title-inline-menu,
    .content-title-cell:focus-within .title-inline-menu {
      opacity: 1;
      pointer-events: auto;
    }
    .title-inline-menu button {
      background: none;
      border: 0;
      padding: 2px 0;
      color: var(--accent, #246b50);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .title-inline-menu .danger-text {
      color: #b42318;
    }
    .title-inline-menu button:disabled {
      color: var(--muted, #888);
      cursor: default;
    }
    .title-inline-menu button:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
      border-radius: 2px;
    }
    @media (hover: none), (prefers-reduced-motion: reduce) {
      .title-inline-menu {
        transition: none;
      }
    }
    @media (hover: none) {
      .title-inline-menu {
        opacity: 1;
        pointer-events: auto;
      }
    }
  `,
  imports: [
    DatePipe,
    FormsModule,
    IconComponent,
    DialogFocusDirective,
    RouterOutlet,
  ],
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">CONTENT STUDIO</p>
        <h1>
          {{
            kind === "post"
              ? "Stories worth sharing."
              : "A place for every part of your story."
          }}
        </h1>
        <p>
          {{
            kind === "post"
              ? "From the first thought to the final word. Make it yours."
              : "Create and organize the pages that bring your site together."
          }}
        </p>
      </div>
      <button class="button primary" (click)="open()">
        <cl-icon name="plus" />Create {{ kind }}
      </button>
    </div>
    <section class="panel">
      <div class="content-toolbar">
        @if (kind === "page") {
          <select aria-label="Filter by role" [(ngModel)]="roleFilter">
            @for (
              role of ["All", "Home", "Posts", "404", "Unassigned"];
              track role
            ) {
              <option>{{ role }}</option>
            }
          </select>
          <select aria-label="Filter by author" [(ngModel)]="authorFilter">
            <option value="">All authors</option>
            @for (author of authors; track author) {
              <option [value]="author">{{ author }}</option>
            }
          </select>
        }
        <div class="tabs" aria-label="Content status">
          @for (tab of filters; track tab) {
            <button [class.selected]="filter === tab" (click)="filter = tab">
              {{ tab }} <span>{{ count(tab) }}</span>
            </button>
          }
        </div>
        <label class="search-field"
          ><cl-icon name="search" /><input
            [(ngModel)]="search"
            placeholder="Search content…"
            aria-label="Search content"
        /></label>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              @if (kind === "page") {
                <th>Slug</th>
                <th>Template</th>
                <th>Author</th>
              }
              <th>Status</th>
              <th>Updated</th>
              @if (seoEnabled) {
                <th>SEO</th>
              }
              <th>View</th>
            </tr>
          </thead>
          <tbody>
            @for (c of filtered; track c.id) {
              <tr>
                <td>
                  <div class="content-title-cell">
                    <button
                      class="content-title title-button"
                      (click)="open(c)"
                    >
                      <span class="content-icon"
                        ><cl-icon
                          [name]="kind === 'post' ? 'posts' : 'pages'" /></span
                      ><span
                        ><strong
                          >{{ c.title }}
                          @if (role(c)) {
                            <span class="badge">{{ role(c) }}</span>
                          }</strong
                        ><small>/{{ c.slug }}</small></span
                      >
                    </button>
                    <div
                      class="title-inline-menu"
                      role="group"
                      [attr.aria-label]="'Actions for ' + c.title"
                    >
                      <button
                        type="button"
                        [attr.aria-label]="'Edit ' + c.title"
                        (click)="open(c)"
                      >
                        Edit
                      </button>
                      <button type="button" (click)="quickEdit(c)">
                        Quick Edit
                      </button>
                      <button
                        type="button"
                        class="danger-text"
                        [attr.aria-label]="'Delete ' + c.title"
                        (click)="deleting = c; error = ''"
                      >
                        Delete
                      </button>
                      @if (seoEnabled) {
                        <button
                          type="button"
                          (click)="instantIndex(c)"
                          [disabled]="
                            !!indexingId ||
                            status(c) !== 'published' ||
                            c.details?.seo?.noindex ||
                            role(c) === '404'
                          "
                          [attr.title]="
                            status(c) !== 'published'
                              ? 'Publish before submitting for indexing'
                              : c.details?.seo?.noindex
                                ? 'Remove noindex before submitting'
                                : 'Submit this URL to IndexNow'
                          "
                        >
                          {{
                            indexingId === c.id
                              ? "Submitting…"
                              : "Instant Index"
                          }}
                        </button>
                      }
                    </div>
                  </div>
                </td>
                @if (kind === "page") {
                  <td>
                    <a [href]="publicPath(c)" target="_blank">/{{ c.slug }}</a>
                  </td>
                  <td>{{ templateName(c) }}</td>
                  <td>{{ c.author }}</td>
                }
                <td>
                  <span [class]="'badge ' + status(c)"
                    ><span></span
                    >{{
                      status(c) === "pending" ? "Pending review" : status(c)
                    }}</span
                  >
                  @if (status(c) === "scheduled") {
                    <small class="schedule-date">{{
                      c.publishAt | date: "MMM d, h:mm a"
                    }}</small>
                  }
                </td>
                <td class="date-cell">{{ c.updatedAt | date: "MMM d, y" }}</td>
                @if (seoEnabled) {
                  <td>
                    <div class="seo-score-cell">
                      <button
                        [class]="'seo-score-badge ' + seo(c).level"
                        [attr.title]="
                          'SEO guidance: ' +
                          seo(c).score +
                          '/100. Click to edit.'
                        "
                        (click)="open(c)"
                      >
                        {{ seo(c).score }} / 100
                        <span>{{
                          seo(c).level === "poor"
                            ? "Bad"
                            : seo(c).level === "fair"
                              ? "Low"
                              : "Good"
                        }}</span>
                      </button>
                      @if (c.details?.seo?.pillarContent) {
                        <span
                          class="pillar-content-icon"
                          title="Pillar content"
                          role="img"
                          aria-label="Pillar content"
                          ><cl-icon name="pillar"
                        /></span>
                      }
                    </div>
                  </td>
                }
                <td>
                  <div class="row-actions">
                    @if (status(c) === "published") {
                      <a
                        class="icon-button"
                        [href]="publicPath(c)"
                        target="_blank"
                        [attr.aria-label]="'View ' + c.title"
                        ><cl-icon name="external"
                      /></a>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td
                  [attr.colspan]="
                    (kind === 'page' ? 7 : 4) + (seoEnabled ? 1 : 0)
                  "
                  class="empty-cell"
                >
                  <h3>No {{ kind }}s found</h3>
                  <p>
                    {{
                      search
                        ? "Try a different search."
                        : "Give your next idea a place to live."
                    }}
                  </p>
                  <button class="button" (click)="open()">
                    Create {{ kind }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="table-footer">
        {{ filtered.length }} {{ filtered.length === 1 ? kind : kind + "s"
        }}<span>All changes are saved to your workspace.</span>
      </div>
    </section>
    <router-outlet />
    @if (quick) {
      <div class="modal-overlay">
        <form
          class="confirm-dialog"
          clDialogFocus
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-title"
          (ngSubmit)="saveQuick()"
        >
          <h2 id="quick-title">Quick Edit {{ kind }}</h2>
          <label class="standalone-field"
            >Title<input
              name="title"
              [(ngModel)]="quick.title"
              required
              maxlength="200"
          /></label>
          <label class="standalone-field"
            >Slug<input
              name="slug"
              [(ngModel)]="quick.slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxlength="160"
          /></label>
          <label class="standalone-field"
            >Status
            <select
              name="status"
              [(ngModel)]="quick.status"
              [disabled]="!!role(quick)"
            >
              <option value="draft">Draft</option>
              <option value="pending">Pending review</option>
              <option value="published">Published</option>
              @if (quick.status === "scheduled") {
                <option value="scheduled">Scheduled</option>
              }
            </select>
          </label>
          @if (role(quick)) {
            <p class="field-note">
              This page serves the {{ role(quick) }} route. Clear or reassign
              that role in General Settings before changing its status.
            </p>
          }
          @if (error) {
            <p class="error">{{ error }}</p>
          }
          <div class="dialog-actions">
            <button type="button" class="button" (click)="quick = null">
              Cancel</button
            ><button class="button primary" [disabled]="busy">Save</button>
          </div>
        </form>
      </div>
    }
    @if (deleting) {
      <div class="modal-overlay">
        <section
          class="confirm-dialog"
          clDialogFocus
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-title"
        >
          <h2 id="delete-title">Delete this {{ kind }}?</h2>
          <p>
            “{{ deleting.title }}” and its revision history will be permanently
            removed.
          </p>
          @if (role(deleting)) {
            <p class="theme-warning" role="status">
              “{{ deleting.title }}” is assigned as the
              {{ role(deleting) }} page. Deleting it will clear that assignment;
              the Frontend will use its default route.
            </p>
          }
          @if (error) {
            <p class="error">{{ error }}</p>
          }
          <div class="dialog-actions">
            <button class="button" (click)="deleting = null">
              Keep {{ kind }}</button
            ><button class="button danger" [disabled]="busy" (click)="remove()">
              Delete {{ kind }}
            </button>
          </div>
        </section>
      </div>
    }
  `,
})
export class ContentComponent implements OnInit {
  indexingId = "";
  async instantIndex(c: Content) {
    if (this.indexingId) return;
    this.indexingId = c.id;
    try {
      const result = await this.api.request("/admin/seo/index", "POST", {
        contentId: c.id,
      });
      this.api.toast(result.message);
    } catch (error) {
      this.api.toast((error as Error).message);
    } finally {
      this.indexingId = "";
    }
  }
  seo(c: Content) {
    return analyzeSeo(c, this.api.state()?.settings);
  }
  get seoEnabled() {
    return !!this.api
      .state()
      ?.plugins.some((p) => p.id === "com.colossal.seo" && p.active);
  }
  api = inject(ApiService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  kind: "page" | "post" = this.route.snapshot.data["kind"];
  search = "";
  filter = "All";
  roleFilter = "All";
  authorFilter = "";
  quick: Content | null = null;
  get authors() {
    return [...new Set(this.all.map((c) => c.author).filter(Boolean))].sort();
  }
  role(c: Content) {
    const s = this.api.state()?.settings;
    return c.id === s?.homePageId
      ? "Home"
      : c.id === s?.postsPageId
        ? "Posts"
        : c.id === s?.notFoundPageId
          ? "404"
          : "";
  }
  templateName(c: Content) {
    if (!c.templateId) return "Default (theme)";
    return (
      this.api
        .state()
        ?.activeTheme?.manifest.templates.find((t) => t.id === c.templateId)
        ?.name || c.templateId + " (fallback)"
    );
  }
  filters = ["All", "Published", "Draft", "Pending", "Scheduled"];
  deleting: Content | null = null;
  busy = false;
  error = "";
  ngOnInit() {
    const q = this.route.snapshot.queryParams;
    if (q["new"]) this.open();
    else if (q["edit"]) {
      const c = this.all.find((c) => c.id === q["edit"]);
      if (c) this.open(c);
    }
  }
  get all() {
    return this.api.state()!.content.filter((c) => c.kind === this.kind);
  }
  status(c: Content) {
    return c.status === "scheduled" && c.publishAt <= new Date().toISOString()
      ? "published"
      : c.status;
  }
  count(filter: string) {
    return this.all.filter(
      (c) => filter === "All" || this.status(c) === filter.toLowerCase(),
    ).length;
  }
  get filtered() {
    return this.all.filter(
      (c) =>
        (this.roleFilter === "All" ||
          (this.role(c) || "Unassigned") === this.roleFilter) &&
        (!this.authorFilter || c.author === this.authorFilter) &&
        (this.filter === "All" ||
          this.status(c) === this.filter.toLowerCase()) &&
        (c.title + " " + c.slug)
          .toLowerCase()
          .includes(this.search.toLowerCase()),
    );
  }
  open(c?: Content) {
    this.router.navigate([c ? "edit" : "new", ...(c ? [c.id] : [])], {
      relativeTo: this.route,
      queryParams: {},
    });
  }
  quickEdit(c: Content) {
    this.quick = structuredClone(c);
    this.error = "";
  }
  async saveQuick() {
    if (!this.quick) return;
    this.busy = true;
    this.error = "";
    try {
      await this.api.mutate(
        "/admin/content",
        "POST",
        {
          ...this.quick,
          expectedUpdatedAt: this.quick.updatedAt,
        },
        this.kind === "post" ? "Post updated." : "Page updated.",
      );
      this.quick = null;
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
    }
  }
  publicPath(c: Content) {
    const d = new Date(c.publishAt);
    return c.kind === "page"
      ? "/" + c.slug
      : "/" +
          d.getUTCFullYear() +
          "/" +
          String(d.getUTCMonth() + 1).padStart(2, "0") +
          "/" +
          c.slug;
  }
  async remove() {
    if (!this.deleting) return;
    this.busy = true;
    try {
      await this.api.mutate(
        "/admin/content/" + this.deleting.id,
        "DELETE",
        {},
        "Entry deleted.",
      );
      this.deleting = null;
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
    }
  }
}
