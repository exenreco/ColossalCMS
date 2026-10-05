import { Component, input } from "@angular/core";
import { SkeletonComponent } from "./skeleton.component";

/** Ready-made skeletons that mirror the shape of the real layouts they stand in for. */

@Component({
  selector: "cl-posts-list-skeleton",
  standalone: true,
  imports: [SkeletonComponent],
  template: `
    <div class="cl-composition" aria-hidden="true">
      <cl-skeleton variant="heading" width="42%" />
      @if (layout() === "grid") {
        <cl-skeleton variant="grid" [width]="3" [count]="6" height="150" />
      } @else {
        <cl-skeleton variant="table-row" [width]="4" [count]="6" />
      }
    </div>
  `,
})
export class PostsListSkeletonComponent {
  layout = input<"table" | "grid">("table");
}

@Component({
  selector: "cl-pages-list-skeleton",
  standalone: true,
  imports: [SkeletonComponent],
  template: `
    <div class="cl-composition" aria-hidden="true">
      <cl-skeleton variant="heading" width="38%" />
      <cl-skeleton variant="table-row" [width]="3" [count]="6" />
    </div>
  `,
})
export class PagesListSkeletonComponent {}

@Component({
  selector: "cl-media-library-skeleton",
  standalone: true,
  imports: [SkeletonComponent],
  template: `
    <div class="cl-composition" aria-hidden="true">
      <div class="cl-composition__chips">
        <cl-skeleton variant="text" width="72px" height="28px" radius="14px" />
        <cl-skeleton variant="text" width="72px" height="28px" radius="14px" />
        <cl-skeleton variant="text" width="72px" height="28px" radius="14px" />
      </div>
      <cl-skeleton variant="text" height="38px" radius="8px" />
      <cl-skeleton variant="grid" [width]="4" [count]="8" height="120" />
    </div>
  `,
})
export class MediaLibrarySkeletonComponent {}

@Component({
  selector: "cl-media-detail-skeleton",
  standalone: true,
  imports: [SkeletonComponent],
  template: `
    <div class="cl-composition" aria-hidden="true">
      <cl-skeleton variant="rectangle" height="240px" />
      <cl-skeleton variant="form" [count]="3" />
    </div>
  `,
})
export class MediaDetailSkeletonComponent {}

@Component({
  selector: "cl-dashboard-skeleton",
  standalone: true,
  imports: [SkeletonComponent],
  template: `
    <div class="cl-composition" aria-hidden="true">
      <div class="cl-composition__stats">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="cl-composition__stat">
            <cl-skeleton variant="text" width="55%" height="12px" />
            <cl-skeleton variant="heading" width="40%" />
          </div>
        }
      </div>
      <cl-skeleton variant="rectangle" height="240px" />
      <cl-skeleton variant="rectangle" height="240px" />
    </div>
  `,
})
export class DashboardSkeletonComponent {}

@Component({
  selector: "cl-settings-skeleton",
  standalone: true,
  imports: [SkeletonComponent],
  template: `
    <div class="cl-composition" aria-hidden="true">
      <div class="cl-composition__chips">
        <cl-skeleton variant="text" width="90px" height="30px" radius="8px" />
        <cl-skeleton variant="text" width="90px" height="30px" radius="8px" />
        <cl-skeleton variant="text" width="90px" height="30px" radius="8px" />
      </div>
      <cl-skeleton variant="form" [count]="5" />
    </div>
  `,
})
export class SettingsSkeletonComponent {}

@Component({
  selector: "cl-themes-list-skeleton",
  standalone: true,
  imports: [SkeletonComponent],
  template: `
    <div class="cl-composition" aria-hidden="true">
      <cl-skeleton variant="heading" width="30%" />
      <cl-skeleton variant="grid" [width]="3" [count]="3" height="200" />
    </div>
  `,
})
export class ThemesListSkeletonComponent {}

@Component({
  selector: "cl-theme-editor-skeleton",
  standalone: true,
  imports: [SkeletonComponent],
  template: `
    <div class="cl-composition cl-composition--editor" aria-hidden="true">
      <cl-skeleton variant="text" height="48px" radius="0" />
      <div class="cl-composition__editor-body">
        <cl-skeleton variant="rectangle" height="100%" radius="0" />
        <div class="cl-composition__editor-side">
          <cl-skeleton variant="form" [count]="4" />
        </div>
      </div>
    </div>
  `,
})
export class ThemeEditorSkeletonComponent {}

@Component({
  selector: "cl-content-editor-skeleton",
  standalone: true,
  imports: [SkeletonComponent],
  template: `
    <div class="cl-composition cl-composition--editor" aria-hidden="true">
      <cl-skeleton variant="text" height="52px" radius="0" />
      <div class="cl-composition__editor-body">
        <cl-skeleton variant="rectangle" height="100%" radius="0" />
        <div class="cl-composition__editor-side">
          <cl-skeleton variant="form" [count]="3" />
          <cl-skeleton variant="form" [count]="2" />
        </div>
      </div>
    </div>
  `,
})
export class ContentEditorSkeletonComponent {}

@Component({
  selector: "cl-post-single-skeleton",
  standalone: true,
  imports: [SkeletonComponent],
  template: `
    <div class="cl-composition cl-composition--article" aria-hidden="true">
      <cl-skeleton variant="heading" width="70%" height="2.4em" />
      <cl-skeleton variant="text" width="30%" height="0.9em" />
      <cl-skeleton variant="rectangle" height="320px" />
      <cl-skeleton variant="paragraph" [count]="4" />
    </div>
  `,
})
export class PostSingleSkeletonComponent {}

@Component({
  selector: "cl-page-skeleton",
  standalone: true,
  imports: [SkeletonComponent],
  template: `
    <div class="cl-composition cl-composition--article" aria-hidden="true">
      <cl-skeleton variant="heading" width="55%" height="2.4em" />
      <cl-skeleton variant="paragraph" [count]="3" />
      <cl-skeleton variant="rectangle" height="260px" />
    </div>
  `,
})
export class PageSkeletonComponent {}

@Component({
  selector: "cl-gltf-block-skeleton",
  standalone: true,
  imports: [SkeletonComponent],
  template: `<div
    class="cl-composition"
    role="status"
    aria-label="Loading 3D model"
    aria-busy="true"
  >
    <cl-skeleton variant="rectangle" height="360px" /><cl-skeleton
      variant="text"
      width="40%"
    />
  </div>`,
})
export class GltfBlockSkeletonComponent {}
