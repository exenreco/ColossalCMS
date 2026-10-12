import { Component, Input } from "@angular/core";
import { DatePipe, DecimalPipe } from "@angular/common";
import { ViewSeries } from "./content-analytics";
@Component({
  selector: "cl-views-chart",
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  template: `<article class="views-chart">
    <div class="chart-summary">
      <div>
        <h3>{{ label }}</h3>
        <strong>{{ series.current | number }}</strong>
      </div>
      <span
        class="chart-change"
        [class.increase]="series.current > series.previous"
        [class.decrease]="series.current < series.previous"
        >{{ change }}</span
      >
    </div>
    <p class="chart-baseline">
      {{ series.previous | number }} in the previous 30 days
    </p>
    <svg
      viewBox="0 0 420 160"
      class="views-plot"
      role="img"
      tabindex="0"
      [attr.aria-label]="
        label +
        ': ' +
        series.current +
        ' views versus ' +
        series.previous +
        ' previously. Use left and right arrows to explore daily values.'
      "
      (keydown)="navigate($event)"
      (focus)="active = labels.length - 1"
    >
      @for (fraction of [0, 0.5, 1]; track fraction) {
        <line
          x1="30"
          x2="410"
          [attr.y1]="y(max * fraction)"
          [attr.y2]="y(max * fraction)"
          class="chart-grid"
        />
        <text x="24" [attr.y]="y(max * fraction) + 3" text-anchor="end">
          {{ max * fraction | number: "1.0-1" }}
        </text>
      }
      <polyline
        [attr.points]="points(series.previousSeries)"
        class="chart-line previous"
      />
      <polyline
        [attr.points]="points(series.currentSeries)"
        class="chart-line current"
      />
      @for (date of labels; track date; let i = $index) {
        <rect
          [attr.x]="x(i) - 6"
          y="4"
          width="12"
          height="128"
          fill="transparent"
          (mouseenter)="active = i"
          (click)="active = i"
        >
          <title>
            {{ date }}: {{ series.currentSeries[i] || 0 }} views; prior period:
            {{ series.previousSeries[i] || 0 }}
          </title>
        </rect>
      }
      @if (active >= 0 && active < labels.length) {
        <circle
          [attr.cx]="x(active)"
          [attr.cy]="y(series.currentSeries[active] || 0)"
          r="4"
          class="chart-point"
        />
      }
      <text x="30" y="153">{{ labels[0] | date: "MMM d" : "UTC" }}</text>
      <text x="410" y="153" text-anchor="end">
        {{ labels[labels.length - 1] | date: "MMM d" : "UTC" }}
      </text>
    </svg>
    <div class="chart-key">
      <span><i class="current"></i>Last 30 days</span
      ><span><i class="previous"></i>Previous 30 days</span>
    </div>
    <p class="chart-detail" aria-live="polite">
      @if (active >= 0 && active < labels.length) {
        {{ labels[active] | date: "MMM d" : "UTC" }}:
        {{ series.currentSeries[active] || 0 }} ·
        {{ previousLabels[active] | date: "MMM d" : "UTC" }}:
        {{ series.previousSeries[active] || 0 }}
      } @else if (!series.current && !series.previous) {
        No views recorded in either period.
      } @else {
        Hover or use arrow keys to explore daily views.
      }
    </p>
    <details class="chart-data">
      <summary>View daily data</summary>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date (UTC)</th>
              <th>Views</th>
              <th>Previous date</th>
              <th>Views</th>
            </tr>
          </thead>
          <tbody>
            @for (date of labels; track date; let i = $index) {
              <tr>
                <td>{{ date }}</td>
                <td>{{ series.currentSeries[i] || 0 }}</td>
                <td>{{ previousLabels[i] }}</td>
                <td>{{ series.previousSeries[i] || 0 }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </details>
  </article>`,
})
export class ViewsChartComponent {
  @Input() label = "Views";
  @Input() series: ViewSeries = {
    current: 0,
    previous: 0,
    currentSeries: [],
    previousSeries: [],
  };
  @Input() labels: string[] = [];
  @Input() previousLabels: string[] = [];
  active = -1;
  get max() {
    return Math.max(
      2,
      ...this.series.currentSeries,
      ...this.series.previousSeries,
    );
  }
  get change() {
    if (!this.series.previous)
      return this.series.current ? "New views" : "No change";
    const value = Math.round(
      ((this.series.current - this.series.previous) / this.series.previous) *
        100,
    );
    return (value > 0 ? "+" : "") + value + "%";
  }
  x(index: number) {
    return 30 + (index * 380) / Math.max(1, this.labels.length - 1);
  }
  y(value: number) {
    return 130 - (value / this.max) * 120;
  }
  points(values: number[]) {
    return this.labels
      .map((_, i) => this.x(i) + "," + this.y(values[i] || 0))
      .join(" ");
  }
  navigate(event: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    this.active =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? this.labels.length - 1
          : Math.max(
              0,
              Math.min(
                this.labels.length - 1,
                this.active + (event.key === "ArrowLeft" ? -1 : 1),
              ),
            );
  }
}
