import { Component, Input } from "@angular/core";
import { Meta, StoryObj } from "@storybook/angular";
import {
  SkeletonAnimation,
  SkeletonComponent,
  SkeletonVariant,
} from "../shared/skeleton.component";
import {
  DashboardSkeletonComponent,
  MediaLibrarySkeletonComponent,
  PagesListSkeletonComponent,
  PostsListSkeletonComponent,
  SettingsSkeletonComponent,
  ThemesListSkeletonComponent,
} from "../shared/skeleton-compositions";

const variants: SkeletonVariant[] = [
  "text",
  "heading",
  "paragraph",
  "circle",
  "rectangle",
  "card",
  "table-row",
  "grid",
  "form",
];

@Component({
  selector: "cl-skeleton-gallery",
  standalone: true,
  imports: [SkeletonComponent],
  template: `
    <div class="cl-skeleton-gallery">
      @for (variant of variants; track variant) {
        <div class="cl-skeleton-cell">
          <p>{{ variant }}</p>
          <cl-skeleton
            [variant]="variant"
            [count]="variant === 'grid' ? 4 : undefined"
            [animation]="animation"
          />
        </div>
      }
    </div>
  `,
  styles: [
    ".cl-skeleton-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:24px;padding:24px}",
    ".cl-skeleton-cell{border:1px solid #e5eae6;border-radius:12px;padding:16px;background:#fff}",
    ".cl-skeleton-cell p{font:600 12px system-ui;margin-bottom:12px}",
  ],
})
class SkeletonGallery {
  variants = variants;
  @Input() animation: SkeletonAnimation = "glare";
}

@Component({
  selector: "cl-composition-gallery",
  standalone: true,
  imports: [
    PostsListSkeletonComponent,
    PagesListSkeletonComponent,
    MediaLibrarySkeletonComponent,
    DashboardSkeletonComponent,
    SettingsSkeletonComponent,
    ThemesListSkeletonComponent,
  ],
  template: `
    <div class="cl-composition-gallery">
      <section>
        <h3>Posts list · table</h3>
        <cl-posts-list-skeleton />
      </section>
      <section>
        <h3>Posts list · grid</h3>
        <cl-posts-list-skeleton layout="grid" />
      </section>
      <section>
        <h3>Pages list</h3>
        <cl-pages-list-skeleton />
      </section>
      <section>
        <h3>Media library</h3>
        <cl-media-library-skeleton />
      </section>
      <section>
        <h3>Dashboard</h3>
        <cl-dashboard-skeleton />
      </section>
      <section>
        <h3>Settings</h3>
        <cl-settings-skeleton />
      </section>
      <section>
        <h3>Themes list</h3>
        <cl-themes-list-skeleton />
      </section>
    </div>
  `,
  styles: [
    ".cl-composition-gallery{display:grid;gap:32px;padding:24px}",
    ".cl-composition-gallery h3{font:650 13px system-ui;margin-bottom:14px;color:#3a4b31}",
  ],
})
class CompositionGallery {}

const meta: Meta = { title: "Workspace/Skeletons 2.0.2" };
export default meta;
export const Variants: StoryObj = {
  render: () => ({
    moduleMetadata: { imports: [SkeletonGallery] },
    template: '<cl-skeleton-gallery [animation]="animation"/>',
    props: { animation: "glare" },
  }),
};
export const PulseAnimation: StoryObj = {
  render: () => ({
    moduleMetadata: { imports: [SkeletonGallery] },
    template: '<cl-skeleton-gallery [animation]="animation"/>',
    props: { animation: "pulse" },
  }),
};
export const ReducedMotion: StoryObj = {
  render: () => ({
    moduleMetadata: { imports: [SkeletonGallery] },
    template: '<cl-skeleton-gallery [animation]="animation"/>',
    props: { animation: "none" },
  }),
};
export const Compositions: StoryObj = {
  render: () => ({
    moduleMetadata: { imports: [CompositionGallery] },
    template: "<cl-composition-gallery/>",
  }),
};
