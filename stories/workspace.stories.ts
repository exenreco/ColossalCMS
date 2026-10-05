import { AfterViewInit, Component, ViewChild, signal } from "@angular/core";
import { applicationConfig, Meta, StoryObj } from "@storybook/angular";
import { ActivatedRoute, Router } from "@angular/router";
import { ApiService } from "../shared/api.service";
import { MediaLibraryComponent } from "../shared/media-library.component";
import { ContentEditorModalComponent } from "../shared/content-editor-modal.component";
import { MediaItem, State } from "../shared/models";
const item: MediaItem = {
  id: "sample",
  type: "image",
  name: "A quiet horizon.svg",
  mime: "image/svg+xml",
  url: "/media-sample.svg",
  altText: "Layered green hills under a golden sun",
  caption: "A quiet horizon",
  description: "A sample illustration for component previews.",
  tags: ["landscape", "illustration"],
  metadata: { size: 480, width: 960, height: 640 },
  uploadedAt: "2026-09-27T12:00:00Z",
  updatedAt: "2026-09-27T12:00:00Z",
  uploadedBy: "editor@example.test",
};
const entry = {
  id: "example",
  kind: "post" as const,
  title: "Make room for a new perspective.",
  slug: "new-perspective",
  body: "A considered space for your next story.",
  excerpt: "Every story begins with a little curiosity.",
  status: "draft" as const,
  publishAt: "",
  updatedAt: "",
  author: "editor@example.test",
  details: {
    featuredImageId: "sample",
    richText: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "A considered space for your next story." },
          ],
        },
      ],
    },
  },
};
const api = {
  state: signal({
    user: { email: "editor@example.test", role: "admin" },
    content: [entry],
    media: [item],
    members: [],
    plugins: [],
    settings: {},
    notices: [],
    activity: [],
    keys: [],
  } as unknown as State),
  request: async () => [],
  load: async () => {},
  toast: () => {},
};
const providers = [
  { provide: ApiService, useValue: api },
  {
    provide: ActivatedRoute,
    useValue: {
      snapshot: {
        data: { kind: "post" },
        paramMap: new Map([["id", "example"]]),
      },
    },
  },
  { provide: Router, useValue: { navigate: async () => true } },
];
@Component({
  selector: "cl-drawer-story",
  standalone: true,
  imports: [MediaLibraryComponent],
  template: "<cl-media-library/>",
})
class DrawerStory implements AfterViewInit {
  @ViewChild(MediaLibraryComponent) library!: MediaLibraryComponent;
  ngAfterViewInit() {
    queueMicrotask(() => this.library.openDetails(item));
  }
}
const meta: Meta = {
  title: "Workspace/V2",
  decorators: [applicationConfig({ providers })],
};
export default meta;
export const MediaGrid: StoryObj = {
  render: () => ({
    moduleMetadata: { imports: [MediaLibraryComponent] },
    template: '<div style="padding:32px"><cl-media-library/></div>',
  }),
};
export const MediaDetailDrawer: StoryObj = {
  render: () => ({
    moduleMetadata: { imports: [DrawerStory] },
    template: "<cl-drawer-story/>",
  }),
};
export const ContentEditorPanels: StoryObj = {
  render: () => ({
    moduleMetadata: { imports: [ContentEditorModalComponent] },
    template: "<cl-content-editor-modal/>",
  }),
};
