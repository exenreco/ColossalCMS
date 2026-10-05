import { Component, inject } from "@angular/core";
import { DatePipe } from "@angular/common";
import { RouterLink } from "@angular/router";
import { ApiService } from "../../../../shared/api.service";
import { IconComponent } from "../../../../shared/icon.component";
import { Content } from "../../../../shared/models";
@Component({
  selector: "cl-dashboard",
  standalone: true,
  imports: [RouterLink, IconComponent, DatePipe],
  template: `
    @for (notice of api.state()!.notices || []; track notice.id) {
      <div class="dashboard-notice" role="status">
        <cl-icon name="bell" /><span>{{ notice.message }}</span
        ><button
          class="icon-button"
          aria-label="Dismiss notice"
          (click)="dismiss(notice.id)"
        >
          <cl-icon name="close" />
        </button>
      </div>
    }
    <div class="page-heading">
      <div>
        <p class="eyebrow">YOUR WORKSPACE, AT A GLANCE</p>
        <h1>Make room for your next big idea<span class="green">.</span></h1>
        <p>Welcome back. Here’s what’s happening with your site.</p>
      </div>
      <a class="button primary" routerLink="/posts" [queryParams]="{ new: 1 }"
        ><cl-icon name="plus" /> Create post</a
      >
    </div>
    <section class="stat-grid" aria-label="Content statistics">
      @for (stat of stats; track stat.label) {
        <a class="stat-card" [routerLink]="stat.route"
          ><div class="stat-top">
            <span>{{ stat.label }}</span
            ><span class="stat-icon"><cl-icon [name]="stat.icon" /></span>
          </div>
          <strong>{{ stat.value }}</strong>
          <div class="stat-bottom">
            <span>{{ stat.detail }}</span
            ><cl-icon name="arrow" /></div
        ></a>
      }
    </section>
    <div class="dashboard-columns">
      <div class="dashboard-main">
        <section class="panel">
          <div class="panel-heading">
            <div>
              <h2>Recent content</h2>
              <p>Your latest ideas, in progress and out in the world.</p>
            </div>
            <a routerLink="/posts" class="text-link"
              >View all <cl-icon name="arrow"
            /></a>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Last updated</th>
                  <th><span class="sr-only">Edit</span></th>
                </tr>
              </thead>
              <tbody>
                @for (c of recent; track c.id) {
                  <tr>
                    <td>
                      <a
                        class="content-title"
                        [routerLink]="c.kind === 'page' ? '/pages' : '/posts'"
                        [queryParams]="{ edit: c.id }"
                        ><span
                          class="content-icon"
                          [class.post-icon]="c.kind === 'post'"
                          ><cl-icon
                            [name]="
                              c.kind === 'post' ? 'posts' : 'pages'
                            " /></span
                        ><span
                          ><strong>{{ c.title }}</strong
                          ><small>{{
                            c.kind === "page" ? "Page" : "Post"
                          }}</small></span
                        ></a
                      >
                    </td>
                    <td>
                      <span class="badge" [class]="'badge ' + status(c)"
                        ><span></span>{{ status(c) }}</span
                      >
                    </td>
                    <td class="date-cell">
                      {{ c.updatedAt | date: "MMM d, y" }}
                    </td>
                    <td>
                      <a
                        class="icon-button"
                        [routerLink]="c.kind === 'page' ? '/pages' : '/posts'"
                        [queryParams]="{ edit: c.id }"
                        [attr.aria-label]="'Edit ' + c.title"
                        ><cl-icon name="chevron"
                      /></a>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="empty-cell">
                      Your next story starts here. Create your first post.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
        <section class="panel activity-panel">
          <div class="panel-heading">
            <div>
              <h2>Workspace activity</h2>
              <p>The small steps that keep things moving.</p>
            </div>
            <span class="subtle-label">Latest updates</span>
          </div>
          <div class="activity-list">
            @for (a of api.state()!.activity.slice(0, 4); track a.id) {
              <div class="activity-item">
                <span class="activity-symbol"><cl-icon name="check" /></span>
                <div>
                  <strong>{{ a.message }}</strong
                  ><small>{{ a.createdAt | date: "MMM d, y · h:mm a" }}</small>
                </div>
              </div>
            }
          </div>
        </section>
      </div>
      <div class="dashboard-side">
        <section class="site-card">
          <div class="site-card-heading">
            <span class="tiny-label">YOUR PUBLIC SITE</span
            ><cl-icon name="globe" />
          </div>
          <div class="site-miniature">
            <div class="mini-nav">
              <strong>{{ api.state()!.settings.title }}</strong
              ><span>JOURNAL</span>
            </div>
            <h3>{{ api.state()!.settings.tagline }}</h3>
            <div class="mini-line"></div>
            <div class="mini-line short"></div>
            <div class="mini-bottom">
              <span>Stories & perspectives</span><cl-icon name="arrow" />
            </div>
          </div>
          <div class="site-card-footer">
            <div>
              <strong>Ready when you are.</strong>
              <p>See your content come to life.</p>
            </div>
            <a href="/" target="_blank" class="button"
              >Open site <cl-icon name="external"
            /></a>
          </div>
        </section>
        <section class="panel publishing-card">
          <h2>Publishing overview</h2>
          <div class="publishing-ring" [style.background]="ring">
            <div>
              <strong>{{ all.length }}</strong
              ><span>total entries</span>
            </div>
          </div>
          <div class="legend">
            @for (s of statuses; track s.name) {
              <div>
                <span class="legend-dot" [style.background]="s.color"></span
                ><span>{{ s.name }}</span
                ><strong>{{ s.count }}</strong>
              </div>
            }
          </div>
        </section>
        <a routerLink="/plugins" class="plugin-callout"
          ><span class="plugin-callout-icon"><cl-icon name="plugins" /></span>
          <div>
            <strong>Small plugins. Big possibilities.</strong>
            <p>Make your workspace work for you.</p>
          </div>
          <cl-icon name="arrow"
        /></a>
      </div>
    </div>
  `,
})
export class DashboardComponent {
  api = inject(ApiService);
  async dismiss(id: string) {
    await this.api.mutate(
      "/admin/notices/" + id,
      "DELETE",
      {},
      "Notice dismissed.",
    );
  }
  get all() {
    return this.api.state()!.content;
  }
  get recent() {
    return this.all.slice(0, 5);
  }
  status(c: Content) {
    return c.status === "scheduled" && c.publishAt <= new Date().toISOString()
      ? "published"
      : c.status;
  }
  count(status: string) {
    return this.all.filter((c) => this.status(c) === status).length;
  }
  get stats() {
    return [
      {
        label: "Total pages",
        value: this.all.filter((c) => c.kind === "page").length,
        detail: "The foundation of your site",
        icon: "pages",
        route: "/pages",
      },
      {
        label: "Total posts",
        value: this.all.filter((c) => c.kind === "post").length,
        detail: "Ideas, stories & updates",
        icon: "posts",
        route: "/posts",
      },
      {
        label: "Media files",
        value: this.api.state()!.media.length,
        detail:
          this.api
            .state()!
            .media.filter(
              (m) => Date.now() - Date.parse(m.uploadedAt) < 7 * 86400000,
            ).length + " uploaded this week",
        icon: "media",
        route: "/media",
      },
      {
        label: "Active plugins",
        value: this.api.state()!.plugins.filter((p) => p.active).length,
        detail: "Working together, seamlessly",
        icon: "plugins",
        route: "/plugins",
      },
    ];
  }
  get statuses() {
    return [
      { name: "Published", count: this.count("published"), color: "#367b61" },
      { name: "Draft", count: this.count("draft"), color: "#b6c8bc" },
      {
        name: "Pending review",
        count: this.count("pending"),
        color: "#8ba9bb",
      },
      { name: "Scheduled", count: this.count("scheduled"), color: "#ddb572" },
    ];
  }
  get ring() {
    const total = this.all.length || 1;
    const p = (this.count("published") / total) * 100;
    const d = p + (this.count("draft") / total) * 100;
    const pending = d + (this.count("pending") / total) * 100;
    return (
      "conic-gradient(#367b61 0% " +
      p +
      "%,#b6c8bc " +
      p +
      "% " +
      d +
      "%,#8ba9bb " +
      d +
      "% " +
      pending +
      "%,#ddb572 " +
      pending +
      "% 100%)"
    );
  }
}
