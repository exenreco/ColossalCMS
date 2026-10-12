import { Component, computed, inject } from "@angular/core";
import { ApiService } from "./api.service";
import { analyzeSeo } from "./seo";
@Component({
  selector: "cl-seo-overview",
  standalone: true,
  template: `@if (enabled) {
    <section
      class="panel analytics-panel seo-overview"
      aria-label="SEO overview"
    >
      <div class="panel-heading">
        <div>
          <h2>SEO overview</h2>
          <p>Content readiness across your pages and posts.</p>
        </div>
        <span class="subtle-label">{{ summary.total }} entries</span>
      </div>
      <div class="seo-chart-grid">
        <div class="seo-quality-chart">
          <svg
            viewBox="0 0 120 120"
            role="img"
            [attr.aria-label]="
              'SEO scores: ' +
              summary.good +
              ' good, ' +
              summary.fair +
              ' low, ' +
              summary.poor +
              ' bad. Average ' +
              summary.average +
              ' out of 100.'
            "
          >
            <circle cx="60" cy="60" r="45" class="donut-base" />
            @for (item of segments; track item.key) {
              <circle
                cx="60"
                cy="60"
                r="45"
                [class]="'donut-segment seo-' + item.key"
                [attr.stroke-dasharray]="
                  (item.count / (summary.total || 1)) * circumference +
                  ' ' +
                  circumference
                "
                [attr.stroke-dashoffset]="
                  (-item.offset / (summary.total || 1)) * circumference
                "
                transform="rotate(-90 60 60)"
              />
            }
            <text x="60" y="60" text-anchor="middle" class="donut-number">
              {{ summary.total ? summary.average : "—" }}
            </text>
            <text x="60" y="76" text-anchor="middle" class="donut-label">
              Average / 100
            </text>
          </svg>
          <div class="seo-chart-legend">
            @for (item of segments; track item.key) {
              <div>
                <i [class]="'seo-dot seo-' + item.key"></i
                ><span>{{ item.label }}</span
                ><strong>{{ item.count }}</strong>
              </div>
            }
          </div>
        </div>
        <div class="seo-type-charts">
          @for (row of byKind; track row.label) {
            <div class="seo-type-chart">
              <div>
                <h3>{{ row.label }}</h3>
                <span>{{ row.total }} entries</span>
              </div>
              <svg
                viewBox="0 0 300 16"
                preserveAspectRatio="none"
                role="img"
                [attr.aria-label]="
                  row.label +
                  ': ' +
                  row.good +
                  ' good, ' +
                  row.fair +
                  ' low, ' +
                  row.poor +
                  ' bad'
                "
              >
                <rect
                  x="0"
                  y="0"
                  width="300"
                  height="16"
                  rx="4"
                  class="seo-bar-base"
                />
                <rect
                  x="0"
                  y="0"
                  [attr.width]="(row.good / (row.total || 1)) * 300"
                  height="16"
                  class="seo-good"
                />
                <rect
                  [attr.x]="(row.good / (row.total || 1)) * 300"
                  y="0"
                  [attr.width]="(row.fair / (row.total || 1)) * 300"
                  height="16"
                  class="seo-fair"
                />
                <rect
                  [attr.x]="((row.good + row.fair) / (row.total || 1)) * 300"
                  y="0"
                  [attr.width]="(row.poor / (row.total || 1)) * 300"
                  height="16"
                  class="seo-poor"
                />
              </svg>
              <p>
                {{ row.good }} good · {{ row.fair }} low · {{ row.poor }} bad
              </p>
            </div>
          }
          <div class="seo-pillar-summary">
            <span>Pillar content</span
            ><strong>{{ summary.pillar }} / {{ summary.total }}</strong>
          </div>
          <div
            class="seo-pillar-track"
            role="img"
            [attr.aria-label]="
              summary.pillar + ' pillar entries out of ' + summary.total
            "
          >
            <span
              [style.width.%]="(summary.pillar / (summary.total || 1)) * 100"
            ></span>
          </div>
        </div>
      </div>
      <p class="analytics-note">
        Scores are editorial guidance, not search rankings.
        {{
          summary.total
            ? "Open an entry to review its SEO checklist, previews, and schema."
            : "Create pages or posts to see their SEO scores here."
        }}
      </p>
    </section>
  }`,
})
export class SeoOverviewComponent {
  api = inject(ApiService);
  circumference = 2 * Math.PI * 45;
  get enabled() {
    return !!this.api
      .state()
      ?.plugins.some(
        (p) => p.id === "com.colossal.seo" && p.installed && p.active,
      );
  }
  private overview = computed(() => {
    const state = this.api.state();
    const scored = (state?.content || []).map((entry) => ({
      entry,
      score: analyzeSeo(entry, state?.settings),
    }));
    const summarize = (items: typeof scored) => ({
      total: items.length,
      pillar: items.filter((c) => c.entry.details?.seo?.pillarContent).length,
      average: items.length
        ? Math.round(
            items.reduce((sum, c) => sum + c.score.score, 0) / items.length,
          )
        : 0,
      good: items.filter((c) => c.score.level === "good").length,
      fair: items.filter((c) => c.score.level === "fair").length,
      poor: items.filter((c) => c.score.level === "poor").length,
    });
    return {
      all: summarize(scored),
      page: summarize(scored.filter((c) => c.entry.kind === "page")),
      post: summarize(scored.filter((c) => c.entry.kind === "post")),
    };
  });
  get summary() {
    return this.overview().all;
  }
  get segments() {
    const s = this.summary;
    return [
      { key: "good", label: "Good scores", count: s.good, offset: 0 },
      { key: "fair", label: "Low scores", count: s.fair, offset: s.good },
      {
        key: "poor",
        label: "Bad scores",
        count: s.poor,
        offset: s.good + s.fair,
      },
    ];
  }
  get byKind() {
    return [
      { label: "Pages", ...this.overview().page },
      { label: "Posts", ...this.overview().post },
    ];
  }
}
