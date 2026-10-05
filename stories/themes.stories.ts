import { AfterViewInit, Component, ViewChild, signal } from "@angular/core";
import { applicationConfig, Meta, StoryObj } from "@storybook/angular";
import { ActivatedRoute, Router } from "@angular/router";
import { ApiService } from "../shared/api.service";
import { ThemeEditorSecondaryToolbarComponent } from "../shared/theme-editor-secondary-toolbar.component";
import { ThemeEditorComponent } from "../shared/theme-editor.component";
import { ThemeBlockTreeComponent } from "../shared/theme-block-tree.component";
import { ThemeEditorState } from "../shared/theme-editor-state";
import { ContextualBlockToolbarComponent } from "../shared/contextual-block-toolbar.component";
import { GltfBlockSkeletonComponent } from "../shared/skeleton-compositions";
import { ThemeDocument } from "../shared/theme-models";
import fixture from "./theme-fixture.json";
const doc = fixture.document as ThemeDocument;
const api = {
  state: signal({
    plugins: [],
    media: [],
    content: [],
    user: { role: "admin" },
  }),
  request: async (path: string) =>
    path.endsWith("/render")
      ? fixture.preview
      : {
          ...doc.manifest,
          published: structuredClone(doc),
          draft: null,
          revision: 1,
          active: true,
          history: [],
        },
  toast: () => {},
  load: async () => {},
};
@Component({
  selector: "cl-theme-inspector-story",
  standalone: true,
  imports: [ThemeEditorComponent],
  template: "<cl-theme-editor/>",
})
class InspectorStory implements AfterViewInit {
  @ViewChild(ThemeEditorComponent) editor!: ThemeEditorComponent;
  ngAfterViewInit() {
    queueMicrotask(() => {
      this.editor.state.load(doc);
      this.editor.state.selected.set(
        doc.templates["default"].children![1].children![0].id,
      );
    });
  }
}
@Component({
  selector: "cl-theme-canvas-story",
  standalone: true,
  imports: [ThemeBlockTreeComponent],
  providers: [ThemeEditorState],
  template:
    '<div class="theme-outline" style="padding:32px;background:#f2f6eb"><cl-theme-block-tree [node]="state.root!"/></div>',
})
class CanvasStory {
  constructor(public state: ThemeEditorState) {
    state.load(doc);
  }
}
@Component({
  selector: "cl-contextual-toolbar-story",
  standalone: true,
  imports: [ContextualBlockToolbarComponent],
  providers: [ThemeEditorState],
  template:
    '<div style="padding:40px;background:#f2f6eb"><cl-contextual-block-toolbar /></div>',
})
class ContextualToolbarStory {
  constructor(public state: ThemeEditorState) {
    state.load(doc);
    state.selected.set(doc.templates["default"].children![1].children![0].id);
  }
}
const meta: Meta = {
  title: "Workspace/Themes 2.0.5",
  decorators: [
    applicationConfig({
      providers: [
        { provide: ApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: new Map([["id", doc.manifest.id]]) },
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: async () => true,
            navigateByUrl: async () => true,
          },
        },
      ],
    }),
  ],
};
export default meta;
export const BlockLibrary: StoryObj = {
  render: () => ({
    moduleMetadata: { imports: [ThemeEditorComponent] },
    template: "<cl-theme-editor/>",
  }),
};
export const HeadingInspector: StoryObj = {
  render: () => ({
    moduleMetadata: { imports: [InspectorStory] },
    template: "<cl-theme-inspector-story/>",
  }),
};
export const NestedCanvas: StoryObj = {
  render: () => ({
    moduleMetadata: { imports: [CanvasStory] },
    template: "<cl-theme-canvas-story/>",
  }),
};
export const ContextualToolbar: StoryObj = {
  render: () => ({
    moduleMetadata: { imports: [ContextualToolbarStory] },
    template: "<cl-contextual-toolbar-story/>",
  }),
};
export const ModelLoadingSkeleton: StoryObj = {
  render: () => ({
    moduleMetadata: { imports: [GltfBlockSkeletonComponent] },
    template: "<cl-gltf-block-skeleton/>",
  }),
};

export const SecondaryToolbar: StoryObj = {
  render: (args) => ({
    props: args,
    moduleMetadata: { imports: [ThemeEditorSecondaryToolbarComponent] },
    template: `<cl-theme-editor-secondary-toolbar [blocksOpen]="blocksOpen" [mode]="mode" [width]="width" [canUndo]="canUndo" [canRedo]="canRedo" (toggleBlocks)="blocksOpen = !blocksOpen" (modeChange)="mode = $event" (widthChange)="width = $event" />`,
  }),
  args: {
    blocksOpen: false,
    mode: "canvas",
    width: 1200,
    canUndo: true,
    canRedo: true,
  },
};
export const MobilePreviewToolbar: StoryObj = {
  ...SecondaryToolbar,
  args: {
    blocksOpen: true,
    mode: "canvas",
    width: 390,
    canUndo: true,
    canRedo: false,
  },
};
export const OutlineToolbar: StoryObj = {
  ...SecondaryToolbar,
  args: {
    blocksOpen: false,
    mode: "outline",
    width: 768,
    canUndo: false,
    canRedo: false,
  },
};
