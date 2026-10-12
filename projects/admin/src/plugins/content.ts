import { ContentTableState } from "../content-table-state";
import { ChangeDetectorRef, Component, inject, OnInit } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterOutlet } from "@angular/router";
import { ApiService } from "../../../../shared/api.service";
import { IconComponent } from "../../../../shared/icon.component";
import { DialogFocusDirective } from "../../../../shared/dialog-focus.directive";
import { AdminModalComponent } from "../../../../shared/admin-modal.component";
import { BulkActionsComponent } from "../../../../shared/bulk-actions.component";
import { TablePaginationComponent } from "../../../../shared/table-pagination.component";
import { TableSelection } from "../../../../shared/table-selection";
import { Content } from "../../../../shared/models";
import { analyzeSeo } from "../../../../shared/seo";
@Component({
  selector: "cl-content",
  standalone: true,
  styles: `
    .quick-edit-dialog {
      display: grid;
      gap: 18px;
    }
    .quick-edit-dialog h2,
    .quick-edit-dialog p {
      margin: 0;
    }
    .quick-edit-dialog .standalone-field {
      gap: 8px;
      margin: 0;
    }
    .quick-edit-dialog select {
      width: 100%;
      padding: 12px;
      border: 1px solid #dce3d5;
      border-radius: 6px;
    }
    .quick-edit-dialog small {
      line-height: 1.5;
      color: var(--muted, #78816e);
    }
    .quick-edit-dialog .dialog-actions {
      padding-top: 6px;
    }
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
      color: #56df95;
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
    AdminModalComponent,
    BulkActionsComponent,
    TablePaginationComponent,
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
    <section class="panel content-filter-panel" aria-label="Content filters">
      <div class="content-toolbar content-filter-columns">
        <div class="tabs" aria-label="Content status">
          @for (tab of filters; track tab) {
            <button
              [class.selected]="filter === tab"
              (click)="filter = tab; page = 1"
            >
              {{ tab }} <span>{{ count(tab) }}</span>
            </button>
          }
        </div>
        <label class="search-field"
          ><cl-icon name="search" /><input
            [(ngModel)]="search"
            (ngModelChange)="page = 1"
            placeholder="Search content…"
            aria-label="Search content"
        /></label>
      </div>
    </section>
    <div class="content-actions-row">
      <cl-bulk-actions
        [showCount]="false"
        [clearBelow]="true"
        [count]="selection.ids.size"
        [actions]="bulkActions"
        [busy]="busy"
        [progress]="bulkProgress"
        [progressTotal]="bulkTotal"
        (applied)="chooseBulk($event)"
        (cleared)="selection.clear()"
      />
      <div class="content-scope-filters">
        @if (kind === "page") {
          <select
            aria-label="Filter by role"
            [(ngModel)]="roleFilter"
            (ngModelChange)="page = 1"
          >
            @for (
              role of ["All", "Home", "Posts", "404", "Unassigned"];
              track role
            ) {
              <option>{{ role }}</option>
            }
          </select>
          <select
            aria-label="Filter by author"
            [(ngModel)]="authorFilter"
            (ngModelChange)="page = 1"
          >
            <option value="">All authors</option>
            @for (author of authors; track author) {
              <option [value]="author">{{ author }}</option>
            }
          </select>
        }
      </div>
    </div>
    @if (bulkMessage) {
      <p class="admin-bulk-result" role="status">{{ bulkMessage }}</p>
    }
    <section class="panel">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th class="selection-cell">
                <input
                  type="checkbox"
                  aria-label="Select all visible entries"
                  [checked]="selection.all(visibleIds)"
                  [indeterminate]="selection.some(visibleIds)"
                  [disabled]="busy || !visibleIds.length"
                  (change)="
                    selection.toggleAll(visibleIds, $any($event.target).checked)
                  "
                />
              </th>
              <th
                [attr.aria-sort]="
                  sortKey === 'title'
                    ? sortDirection === 1
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                "
              >
                <button class="table-sort" (click)="sort('title')">
                  Title<cl-icon name="chevron" />
                </button>
              </th>
              @if (kind === "page") {
                <th
                  data-column="slug"
                  [hidden]="!tableColumns.visible(kind, 'slug')"
                >
                  Slug
                </th>
                <th
                  data-column="template"
                  [hidden]="!tableColumns.visible(kind, 'template')"
                >
                  Template
                </th>
                <th
                  data-column="author"
                  [hidden]="!tableColumns.visible(kind, 'author')"
                >
                  Author
                </th>
              }
              <th
                data-column="status"
                [hidden]="!tableColumns.visible(kind, 'status')"
                [attr.aria-sort]="
                  sortKey === 'status'
                    ? sortDirection === 1
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                "
              >
                <button class="table-sort" (click)="sort('status')">
                  Status<cl-icon name="chevron" />
                </button>
              </th>
              <th
                data-column="updatedAt"
                [hidden]="!tableColumns.visible(kind, 'updatedAt')"
                [attr.aria-sort]="
                  sortKey === 'updatedAt'
                    ? sortDirection === 1
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                "
              >
                <button class="table-sort" (click)="sort('updatedAt')">
                  Updated<cl-icon name="chevron" />
                </button>
              </th>
              @if (seoEnabled) {
                <th
                  data-column="seo"
                  [hidden]="!tableColumns.visible(kind, 'seo')"
                >
                  SEO
                </th>
              }
              <th
                data-column="views30Days"
                [hidden]="!tableColumns.visible(kind, 'views30Days')"
                title="Public page loads in the last 30 days"
              >
                Views (30 days)
              </th>
              <th
                data-column="view"
                [hidden]="!tableColumns.visible(kind, 'view')"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            @for (c of paginated; track c.id) {
              <tr [class.row-selected]="selection.ids.has(c.id)">
                <td class="selection-cell">
                  <input
                    type="checkbox"
                    [attr.aria-label]="'Select ' + c.title"
                    [checked]="selection.ids.has(c.id)"
                    [disabled]="busy"
                    (change)="
                      selection.toggle(c.id, $any($event.target).checked)
                    "
                  />
                </td>
                <td data-column="title">
                  <div class="content-title-cell">
                    <button
                      class="content-title title-button"
                      [disabled]="busy"
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
                        [disabled]="busy"
                        (click)="open(c)"
                      >
                        Edit
                      </button>
                      <span class="action-separator" aria-hidden="true">|</span>
                      <button
                        type="button"
                        [disabled]="busy"
                        (click)="quickEdit(c)"
                      >
                        Quick Edit
                      </button>
                      <span class="action-separator" aria-hidden="true">|</span>
                      <button
                        type="button"
                        class="danger-text"
                        [attr.aria-label]="'Delete ' + c.title"
                        [disabled]="busy"
                        (click)="deleting = c; error = ''"
                      >
                        Delete
                      </button>
                      @if (seoEnabled) {
                        <span class="action-separator" aria-hidden="true">|</span>
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
                  <td
                    data-column="slug"
                    [hidden]="!tableColumns.visible(kind, 'slug')"
                  >
                    <a [href]="publicPath(c)" target="_blank">/{{ c.slug }}</a>
                  </td>
                  <td
                    data-column="template"
                    [hidden]="!tableColumns.visible(kind, 'template')"
                  >
                    {{ templateName(c) }}
                  </td>
                  <td
                    data-column="author"
                    [hidden]="!tableColumns.visible(kind, 'author')"
                  >
                    {{ c.author }}
                  </td>
                }
                <td
                  data-column="status"
                  [hidden]="!tableColumns.visible(kind, 'status')"
                >
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
                <td
                  class="date-cell"
                  data-column="updatedAt"
                  [hidden]="!tableColumns.visible(kind, 'updatedAt')"
                >
                  {{ c.updatedAt | date: "MMM d, y" }}
                </td>
                @if (seoEnabled) {
                  <td
                    data-column="seo"
                    [hidden]="!tableColumns.visible(kind, 'seo')"
                  >
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
                <td
                  data-column="views30Days"
                  [hidden]="!tableColumns.visible(kind, 'views30Days')"
                >
                  {{ c.views30Days || 0 }}
                </td>
                <td
                  data-column="view"
                  [hidden]="!tableColumns.visible(kind, 'view')"
                >
                  <div class="row-actions">
                    <button
                      type="button"
                      class="icon-button"
                      [disabled]="busy"
                      [attr.aria-label]="'Edit ' + c.title"
                      title="Edit"
                      (click)="open(c)"
                    >
                      <cl-icon name="edit-square" />
                    </button>
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
                  [attr.colspan]="tableColumns.count(kind, seoEnabled)"
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
      <cl-table-pagination
        [total]="filtered.length"
        [page]="currentPage"
        [pageSize]="pageSize"
        (pageChanged)="page = $event"
        (pageSizeChanged)="pageSize = $event; page = 1"
      />
    </section>
    <router-outlet />
    @if (quick) {
      <cl-admin-modal
        [title]="'Quick Edit ' + kind"
        [description]="quick.title"
        [icon]="kind === 'page' ? 'pages' : 'posts'"
        [busy]="busy"
        (dismissed)="quick = null"
      >
        <form class="quick-edit-dialog" (ngSubmit)="saveQuick()">
          <label class="standalone-field"
            >Title<input
              name="title"
              autofocus
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
              that role in Reading Settings before changing its status.
            </p>
          }
          @if (kind === "page") {
            <label class="standalone-field"
              >Order
              <input
                type="number"
                name="order"
                step="1"
                [(ngModel)]="quickOrder"
                required
              />
              <small
                >Lower numbers appear first in the Pages table. Default:
                0.</small
              >
            </label>
          }
          @if (error) {
            <p class="error">{{ error }}</p>
          }
          <div class="dialog-actions">
            <button
              type="button"
              class="button"
              [disabled]="busy"
              (click)="quick = null"
            >
              Cancel</button
            ><button class="button primary" [disabled]="busy">Save</button>
          </div>
        </form>
      </cl-admin-modal>
    }
    @if (bulkDeleteConfirm) {
      <cl-admin-modal
        title="Delete selected entries?"
        icon="trash"
        [busy]="busy"
        (dismissed)="bulkDeleteConfirm = false"
      >
        <p>
          {{ selection.ids.size }} {{ kind }}s and their revision history will
          be permanently removed. Assigned page routes will fall back to their
          defaults.
        </p>
        <div class="dialog-actions">
          <button
            class="button"
            [disabled]="busy"
            (click)="bulkDeleteConfirm = false"
          >
            Cancel</button
          ><button
            class="button danger"
            [disabled]="busy"
            (click)="runBulk('delete')"
          >
            Delete selected
          </button>
        </div>
      </cl-admin-modal>
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
  private bulkCdr = inject(ChangeDetectorRef);
  selection = new TableSelection();
  page = 1;
  pageSize = 10;
  sortKey = "";
  sortDirection = 1;
  bulkProgress = 0;
  bulkTotal = 0;
  bulkMessage = "";
  bulkDeleteConfirm = false;
  bulkActions = [
    { value: "published", label: "Publish" },
    { value: "draft", label: "Move to draft" },
    { value: "pending", label: "Submit for review" },
    { value: "delete", label: "Delete" },
  ];
  get currentPage() {
    return Math.min(
      this.page,
      Math.max(1, Math.ceil(this.filtered.length / this.pageSize)),
    );
  }
  get paginated() {
    return this.filtered.slice(
      (this.currentPage - 1) * this.pageSize,
      this.currentPage * this.pageSize,
    );
  }
  get visibleIds() {
    return this.paginated.map((c) => c.id);
  }
  sort(key: string) {
    this.sortDirection = this.sortKey === key ? -this.sortDirection : 1;
    this.sortKey = key;
    this.page = 1;
  }
  chooseBulk(action: string) {
    if (this.busy || !this.selection.ids.size) return;
    if (action === "delete") this.bulkDeleteConfirm = true;
    else void this.runBulk(action);
  }
  async runBulk(action: string) {
    if (
      this.busy ||
      !["published", "draft", "pending", "delete"].includes(action)
    )
      return;
    const items = this.all.filter((c) => this.selection.ids.has(c.id));
    if (!items.length) return;
    this.busy = true;
    this.bulkProgress = 0;
    this.bulkTotal = items.length;
    this.bulkMessage = "";
    const failures: string[] = [];
    let completed = 0;
    try {
      for (const c of items) {
        try {
          await this.api.request(
            action === "delete"
              ? "/admin/content/" + encodeURIComponent(c.id)
              : "/admin/content",
            action === "delete" ? "DELETE" : "POST",
            action === "delete"
              ? {}
              : {
                  ...c,
                  status: action,
                  ...(action === "published"
                    ? { publishAt: new Date().toISOString() }
                    : {}),
                  expectedUpdatedAt: c.updatedAt,
                },
          );
          this.selection.ids.delete(c.id);
          completed++;
        } catch (error) {
          failures.push(c.title + ": " + (error as Error).message);
        }
        this.bulkProgress++;
        this.bulkCdr.markForCheck();
      }
      this.bulkMessage =
        completed +
        " of " +
        items.length +
        " entries updated." +
        (failures.length
          ? " Failed entries remain selected. " + failures.join(" ")
          : "");
      await this.api.load();
    } catch (error) {
      this.bulkMessage += " " + (error as Error).message;
    } finally {
      this.busy = false;
      this.bulkDeleteConfirm = false;
      this.bulkCdr.markForCheck();
    }
  }
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
  tableColumns = inject(ContentTableState);
  api = inject(ApiService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  kind: "page" | "post" = this.route.snapshot.data["kind"];
  search = "";
  filter = "All";
  roleFilter = "All";
  authorFilter = "";
  quick: Content | null = null;
  quickOrder = 0;
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
    const items = this.all.filter(
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
    if (this.sortKey)
      return items.sort(
        (a, b) =>
          String(a[this.sortKey as keyof Content] ?? "").localeCompare(
            String(b[this.sortKey as keyof Content] ?? ""),
          ) * this.sortDirection,
      );
    return this.kind === "page"
      ? items.sort((a, b) => (a.details?.order ?? 0) - (b.details?.order ?? 0))
      : items;
  }
  open(c?: Content) {
    if (this.busy) return;
    this.router.navigate([c ? "edit" : "new", ...(c ? [c.id] : [])], {
      relativeTo: this.route,
      queryParams: {},
    });
  }
  quickEdit(c: Content) {
    if (this.busy) return;
    this.quick = structuredClone(c);
    this.quickOrder = c.details?.order ?? 0;
    this.error = "";
  }
  async saveQuick() {
    if (!this.quick || this.busy) return;
    this.busy = true;
    this.error = "";
    try {
      await this.api.mutate(
        "/admin/content",
        "POST",
        {
          ...this.quick,
          ...(this.kind === "page"
            ? { details: { ...this.quick.details, order: this.quickOrder } }
            : {}),
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
