import {
  Component,
  ChangeDetectorRef,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  HostListener,
  effect,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatePipe, NgComponentOutlet } from "@angular/common";
import { ActivatedRoute, Router } from "@angular/router";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { Editor, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { ApiService } from "./api.service";
import { MediaSelectionService } from "./media-selection.service";
import {
  ContentEditorPanelRegistry,
  ContentEditorContext,
} from "./content-editor-panel-registry";
import { IconComponent } from "./icon.component";
import { DialogFocusDirective } from "./dialog-focus.directive";
import { ThemeEditorState } from "./theme-editor-state";
import { ThemeBlockTreeComponent } from "./theme-block-tree.component";
import { hydrateSliders } from "./swiper-host";
import { hydrateModels } from "./gltf-host";
import { modelFieldVisible } from "./model-field-visibility";
import { themeBodyAttributes } from "./theme-body";
import { BlockLibraryDrawerComponent } from "./block-library-drawer.component";
import { BlockListDrawerComponent } from "./block-list-drawer.component";
import { BlockIconComponent } from "./block-icon.component";
import { ThemeEditorSecondaryToolbarComponent } from "./theme-editor-secondary-toolbar.component";
import { ContextualBlockToolbarComponent } from "./contextual-block-toolbar.component";
import { BlockField, BlockNode, ThemeDocument } from "./theme-models";
import {
  AppearancePickerPanelComponent,
  PICKER_FIELD_KEYS,
} from "./pickers/appearance-picker-panel.component";
import { Content, RichNode } from "./models";
@Component({
  selector: "cl-content-editor-modal",
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    NgComponentOutlet,
    IconComponent,
    DialogFocusDirective,
    ThemeBlockTreeComponent,
    BlockLibraryDrawerComponent,
    BlockListDrawerComponent,
    BlockIconComponent,
    ThemeEditorSecondaryToolbarComponent,
    ContextualBlockToolbarComponent,
    AppearancePickerPanelComponent,
  ],
  providers: [ThemeEditorState],
  template: `
    <section
      class="content-editor-fullscreen"
      [class.block-workspace]="mode === 'blocks'"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-heading"
      clDialogFocus
    >
      <header class="editor-topbar">
        <button class="icon-button" aria-label="Close editor" (click)="close()">
          <cl-icon name="close" />
        </button>
        <div class="editor-topbar-title">
          <span class="eyebrow">{{
            kind === "post" ? "POST STUDIO" : "PAGE STUDIO"
          }}</span>
          <h2 id="editor-heading">{{ entry.title || "Untitled " + kind }}</h2>
        </div>
        <span class="autosave-state" role="status">{{ savedLabel }}</span
        ><button class="button" [disabled]="busy()" (click)="save('draft')">
          Save draft</button
        ><button
          class="button primary"
          [disabled]="busy()"
          (click)="
            save(
              entry.status === 'scheduled'
                ? 'scheduled'
                : entry.status === 'pending'
                  ? 'pending'
                  : 'published'
            )
          "
        >
          {{
            busy()
              ? "Saving…"
              : entry.status === "scheduled"
                ? "Schedule"
                : entry.status === "pending"
                  ? "Submit for review"
                  : "Publish"
          }}<cl-icon name="check" />
        </button>
      </header>
      @if (
        mode === "blocks" &&
        toolbarVisible &&
        !toolbarHidden &&
        themeState.node &&
        !themeState.protected(themeState.node)
      ) {
        <cl-contextual-block-toolbar
          [style.position]="'fixed'"
          [style.z-index]="120"
          [style.left.px]="toolbarPosition.left"
          [style.top.px]="toolbarPosition.top"
          [style.width.px]="toolbarPosition.width"
          (dismiss)="dismissBlockToolbar()"
          (format)="formatBlockText($event)"
          (replace)="replaceBlockMedia($event)"
        />
      }
      @if (error()) {
        <div class="editor-error error" role="alert">{{ error() }}</div>
      }
      @if (mode === "blocks") {
        <cl-theme-editor-secondary-toolbar
          [blocksOpen]="libraryOpen"
          [blockListOpen]="blockListOpen"
          [mode]="viewMode"
          [width]="previewWidth"
          [canUndo]="!!themeState.past.length"
          [canRedo]="!!themeState.future.length"
          (toggleBlocks)="toggleLibrary()"
          (toggleBlockList)="toggleBlockList()"
          (modeChange)="setViewMode($event)"
          (widthChange)="setPreviewWidth($event)"
          (undo)="themeState.undo()"
          (redo)="themeState.redo()"
        />
      }
      <div
        class="content-editor-panes"
        [class.library-open]="
          (libraryOpen || blockListOpen) && mode === 'blocks'
        "
      >
        <aside
          id="block-library-drawer"
          class="content-theme-library"
          [attr.aria-hidden]="!(libraryOpen && mode === 'blocks')"
          [attr.inert]="libraryOpen && mode === 'blocks' ? null : ''"
        >
          <cl-block-library-drawer
            [open]="libraryOpen && mode === 'blocks'"
            [columnsSelected]="themeState.node?.type === 'core/columns'"
            [blocks]="contentBlockDefinitions"
            [recent]="recentBlocks"
            (choose)="insertThemeBlock($event)"
            (pointerStart)="libraryPointerStart($event)"
            (dismiss)="toggleLibrary(false)"
          />
        </aside>
        <aside
          id="block-list-drawer"
          class="content-theme-library content-block-list-drawer"
          [attr.aria-hidden]="!(blockListOpen && mode === 'blocks')"
          [attr.inert]="blockListOpen && mode === 'blocks' ? null : ''"
        >
          @if (blockListOpen && mode === "blocks") {
            <cl-block-list-drawer (close)="toggleBlockList(false)" />
          }
        </aside>
        <div class="editor-columns">
          <div class="editor-writing">
            <div class="editor-paper">
              <input
                class="editor-title-input"
                aria-label="Title"
                [(ngModel)]="entry.title"
                (ngModelChange)="autoSlug()"
                placeholder="Give your story a title"
                maxlength="200"
                autofocus
              />
              <div class="editor-body-heading">
                <div>
                  <span class="eyebrow">YOUR CONTENT</span>
                  <h3>Body</h3>
                </div>
                <div
                  class="editor-mode-switch"
                  role="group"
                  aria-label="Editor mode"
                >
                  <button
                    type="button"
                    [attr.aria-pressed]="mode === 'blocks'"
                    (click)="switchMode('blocks')"
                  >
                    Blocks
                  </button>
                  <button
                    type="button"
                    [attr.aria-pressed]="mode === 'html'"
                    (click)="switchMode('html')"
                  >
                    HTML
                  </button>
                </div>
              </div>
              @if (mode === "blocks" && themeState.root; as root) {
                @if (viewMode === "outline") {
                  <div
                    class="content-theme-outline"
                    aria-label="Post or page block outline"
                    [style.max-width.px]="previewWidth"
                  >
                    <cl-theme-block-tree [node]="root" />
                  </div>
                } @else {
                  <div class="content-canvas-scroll">
                    <iframe
                      #canvasFrame
                      class="content-live-preview"
                      title="Live post or page canvas"
                      sandbox="allow-same-origin"
                      [style.width.px]="previewWidth"
                      [srcdoc]="previewHtml"
                      (load)="enhanceContentCanvas()"
                    ></iframe>
                  </div>
                }
                <div class="content-canvas-status">
                  {{
                    viewMode === "outline"
                      ? "Drag to arrange blocks"
                      : "Live preview of unsaved content"
                  }}
                  · {{ previewWidth }} px
                  @if (previewError) {
                    <span role="alert">{{ previewError }}</span>
                  }
                  @if (previewNotice) {
                    <span role="status">{{ previewNotice }}</span>
                  }
                </div>
              }
              <div
                #surface
                class="rich-editor-surface content-editor-parser"
                hidden
              ></div>
              @if (mode === "html") {
                <label class="editor-html-label" for="editor-html-source"
                  >HTML source</label
                >
                <textarea
                  id="editor-html-source"
                  class="editor-html-source"
                  aria-label="HTML source"
                  [(ngModel)]="htmlSource"
                  [spellcheck]="false"
                  autocapitalize="off"
                  autocomplete="off"
                  autocorrect="off"
                  placeholder="<p>Write your content as HTML…</p>"
                ></textarea>
                <p class="editor-html-help">
                  Edit the selected
                  {{
                    themeState.node?.type === "core/html"
                      ? "HTML fragment"
                      : "Rich text"
                  }}
                  block as HTML. Safe block markup stays in place when switching
                  views or saving. Scripts, embeds and unsafe links are
                  rejected.
                </p>
              }
              <div class="editor-word-count">
                {{ mode === "html" ? sourceWordCount : wordCount() }} words ·
                {{ themeState.root?.children?.length || 0 }}
                {{
                  themeState.root?.children?.length === 1 ? "block" : "blocks"
                }}
                <span>Ctrl / ⌘ S to save · Ctrl / ⌘ Enter to publish</span>
              </div>
            </div>
          </div>
          <aside class="editor-options" aria-label="Content options">
            @if (mode === "blocks" && themeState.node) {
              <section
                class="content-block-inspector"
                aria-label="Block Inspector"
              >
                <p class="eyebrow">
                  {{
                    themeState.node === themeState.root
                      ? "MAIN SETTINGS"
                      : "BLOCK SETTINGS"
                  }}
                </p>
                <h3>
                  <cl-block-icon
                    [icon]="
                      themeState.node === themeState.root
                        ? 'fas fa-file-alt'
                        : themeState.iconFor(themeState.node.type)
                    "
                  />
                  {{ themeState.label(themeState.node) }}
                </h3>
                @if (themeState.node !== themeState.root) {
                  <div class="content-block-inspector__actions">
                    <button
                      type="button"
                      class="button small"
                      (click)="themeState.duplicate()"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      class="button small"
                      (click)="themeState.remove()"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      class="button small"
                      (click)="themeState.shift(-1)"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      class="button small"
                      (click)="themeState.shift(1)"
                    >
                      ↓
                    </button>
                  </div>
                }
                @for (field of selectedBlockFields; track field.key) {
                  <label class="theme-field"
                    >{{ field.label }}
                    @switch (field.type) {
                      @case ("select") {
                        <select
                          [ngModel]="themeState.node.settings[field.key]"
                          (ngModelChange)="themeState.set(field.key, $event)"
                        >
                          @for (option of field.options || []; track option) {
                            <option [value]="option">{{ option }}</option>
                          }
                        </select>
                      }
                      @case ("checkbox") {
                        <input
                          type="checkbox"
                          [ngModel]="themeState.node.settings[field.key]"
                          (ngModelChange)="themeState.set(field.key, $event)"
                        />
                      }
                      @case ("textarea") {
                        <textarea
                          rows="5"
                          [ngModel]="themeState.node.settings[field.key]"
                          (ngModelChange)="themeState.set(field.key, $event)"
                        ></textarea>
                      }
                      @case ("image") {
                        <button
                          type="button"
                          class="button"
                          (click)="selectBlockMedia(field)"
                        >
                          Choose image
                        </button>
                      }
                      @case ("media") {
                        <button
                          type="button"
                          class="button"
                          (click)="selectBlockMedia(field)"
                        >
                          Choose media
                        </button>
                      }
                      @case ("model") {
                        <button
                          type="button"
                          class="button"
                          (click)="selectBlockMedia(field)"
                        >
                          Choose model
                        </button>
                      }
                      @default {
                        <input
                          [type]="field.type === 'number' ? 'number' : 'text'"
                          [ngModel]="themeState.node.settings[field.key]"
                          (ngModelChange)="themeState.set(field.key, $event)"
                        />
                      }
                    }
                  </label>
                }
                <cl-appearance-picker-panel
                  [settings]="themeState.node.settings"
                  [blockType]="themeState.node.type"
                  [palette]="themeState.document()?.manifest?.palette || []"
                  (settingChange)="themeState.set($event.key, $event.value)"
                />
              </section>
            }
            @if (kind === "post") {
              <details class="editor-option-panel">
                <summary>Portfolio project<cl-icon name="chevron" /></summary>
                <div class="editor-option-content">
                  <label
                    ><input
                      type="checkbox"
                      [ngModel]="
                        entry.details!.panelData?.['portfolioProject'] === true
                      "
                      (ngModelChange)="setPanel('portfolioProject', $event)"
                    />
                    Show in portfolio</label
                  >
                  <label
                    >Project category<input
                      [ngModel]="
                        entry.details!.panelData?.['projectCategory'] || ''
                      "
                      (ngModelChange)="setPanel('projectCategory', $event)"
                      placeholder="WEB DEVELOPMENT / UI"
                  /></label>
                  <label
                    >Project image URL<input
                      [ngModel]="
                        entry.details!.panelData?.['projectImageUrl'] || ''
                      "
                      (ngModelChange)="setPanel('projectImageUrl', $event)"
                      placeholder="https://example.com/project.png"
                  /></label>
                  <p class="field-note">
                    Use an HTTPS image URL. Edit the case study in the canvas.
                  </p>
                </div>
              </details>
            }
            @for (panel of panels.panels(); track panel.id) {
              <details
                class="editor-option-panel"
                [open]="
                  panel.id === 'status' ||
                  panel.id === 'summary' ||
                  panel.id === 'featured'
                "
              >
                <summary>{{ panel.title }}<cl-icon name="chevron" /></summary>
                <div class="editor-option-content">
                  @switch (panel.id) {
                    @case ("status") {
                      <label
                        >Status<select [(ngModel)]="entry.status">
                          <option value="draft">Draft</option>
                          <option value="pending">Pending review</option>
                          <option value="published">Published</option>
                          <option value="scheduled">Scheduled</option>
                        </select></label
                      >
                      @if (entry.status === "scheduled") {
                        <label
                          >Publish on (local time)<input
                            type="datetime-local"
                            [(ngModel)]="schedule"
                        /></label>
                      }
                      <p class="field-note">
                        Drafts and pending entries are visible only in your
                        workspace.
                      </p>
                    }
                    @case ("summary") {
                      <label
                        >Excerpt<textarea
                          aria-label="Excerpt"
                          [(ngModel)]="entry.excerpt"
                          (ngModelChange)="scheduleCanvas()"
                          maxlength="500"
                          rows="5"
                          placeholder="A short introduction for your readers…"
                        ></textarea>
                      </label>
                      <p class="field-note">
                        Used in listings and previews.
                        {{ entry.excerpt.length }}/500 characters
                      </p>
                    }
                    @case ("template") {
                      <p class="field-note">
                        Using
                        {{
                          entry.templateId && !templateWarning
                            ? "content override"
                            : templateScope !== kind
                              ? "role default"
                              : "theme default"
                        }}:
                        {{
                          entry.templateId && !templateWarning
                            ? selectedTemplateName
                            : defaultTemplateName
                        }}.
                      </p>
                      @if (templateScope !== kind) {
                        <p class="field-note">
                          This page is assigned to
                          {{
                            templateScope === "post-index"
                              ? "Posts"
                              : templateScope === "home"
                                ? "Home"
                                : "404"
                          }}, so templates for that role are shown.
                        </p>
                      }
                      @if (entry.templateId) {
                        <button
                          class="button"
                          (click)="entry.templateId = ''; scheduleCanvas()"
                        >
                          Clear override
                        </button>
                      }
                      <label
                        >Theme template<select
                          [(ngModel)]="entry.templateId"
                          (ngModelChange)="scheduleCanvas()"
                        >
                          <option value="">
                            Automatic ({{ defaultTemplateName }})
                          </option>
                          @for (t of availableTemplates; track t.id) {
                            <option [value]="t.id">{{ t.name }}</option>
                          }
                        </select></label
                      >
                      @if (templateWarning) {
                        <p class="theme-warning" role="status">
                          {{ templateWarning }}
                        </p>
                      }
                      <p class="field-note">
                        From
                        {{
                          api.state()?.activeTheme?.manifest?.name ||
                            "the active theme"
                        }}. Changing themes preserves your content.
                      </p>
                    }
                    @case ("featured") {
                      @if (featured) {
                        <div class="featured-preview">
                          <img
                            [src]="featured.url + '?v=' + featured.updatedAt"
                            [alt]="featured.altText"
                          /><button
                            class="icon-button"
                            aria-label="Remove featured image"
                            (click)="entry.details!.featuredImageId = ''"
                          >
                            <cl-icon name="close" />
                          </button>
                        </div>
                      }
                      <button
                        class="button full-width"
                        (click)="selectFeatured()"
                      >
                        <cl-icon name="media" />{{
                          featured ? "Change image" : "Select from media"
                        }}
                      </button>
                    }
                    @case ("taxonomy") {
                      <label
                        >Categories<input
                          [(ngModel)]="categories"
                          list="category-options"
                          placeholder="Separate with commas" /></label
                      ><datalist id="category-options">
                        @for (term of categoryOptions; track term) {
                          <option [value]="term"></option>
                        }</datalist
                      ><label
                        >Tags<input
                          [(ngModel)]="tags"
                          list="tag-options"
                          placeholder="Separate with commas" /></label
                      ><datalist id="tag-options">
                        @for (term of tagOptions; track term) {
                          <option [value]="term"></option>
                        }
                      </datalist>
                      <p class="field-note">
                        Type a new term or choose one you’ve used before.
                      </p>
                    }
                    @case ("seo") {
                      <label
                        >URL slug<input
                          [(ngModel)]="entry.slug"
                          (input)="slugEdited = true"
                          maxlength="160" /></label
                      ><label
                        >Meta title<input
                          [(ngModel)]="entry.details!.metaTitle"
                          maxlength="200"
                          [placeholder]="entry.title || 'Page title'" /></label
                      ><label
                        >Meta description<textarea
                          [(ngModel)]="entry.details!.metaDescription"
                          maxlength="500"
                          rows="4"
                        ></textarea>
                      </label>
                    }
                    @case ("authoring") {
                      <label
                        >Author<select [(ngModel)]="entry.author">
                          @for (member of authors; track member) {
                            <option [value]="member">{{ member }}</option>
                          }
                        </select></label
                      >
                      <p class="field-note">
                        Publication date:
                        {{
                          entry.publishAt
                            ? (entry.publishAt | date: "medium")
                            : "Not published yet"
                        }}
                      </p>
                      <h3>Revision history</h3>
                      <div class="revision-list">
                        @for (rev of revisions(); track rev.id) {
                          <button (click)="restore(rev.snapshot)">
                            <span>{{
                              rev.snapshot._autosave
                                ? "Autosaved draft"
                                : "Saved revision"
                            }}</span
                            ><small>{{
                              rev.created_at | date: "MMM d, h:mm a"
                            }}</small>
                          </button>
                        } @empty {
                          <p class="field-note">
                            Your first save starts the history.
                          </p>
                        }
                      </div>
                    }
                    @default {
                      @if (panel.component) {
                        <ng-container *ngComponentOutlet="panel.component" />
                      }
                      @for (field of panel.fields || []; track field.key) {
                        <label
                          >{{ field.label }}
                          @if (field.type === "textarea") {
                            <textarea
                              [ngModel]="
                                entry.details!.panelData?.[field.key] || ''
                              "
                              (ngModelChange)="setPanel(field.key, $event)"
                              rows="3"
                            ></textarea>
                          } @else {
                            <input
                              [ngModel]="
                                entry.details!.panelData?.[field.key] || ''
                              "
                              (ngModelChange)="setPanel(field.key, $event)"
                            />
                          }
                        </label>
                      }
                    }
                  }
                </div>
              </details>
            }
          </aside>
        </div>
      </div>
    </section>
    @if (confirmLeave) {
      <div class="modal-overlay editor-confirm-layer">
        <section
          class="confirm-dialog"
          clDialogFocus
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="leave-title"
        >
          <h2 id="leave-title">Leave unsaved changes?</h2>
          <p>Your changes since the last save will be discarded.</p>
          <div class="dialog-actions">
            <button class="button" (click)="resolveLeave(false)">
              Keep editing</button
            ><button class="button danger" (click)="resolveLeave(true)">
              Discard changes
            </button>
          </div>
        </section>
      </div>
    }
  `,
})
export class ContentEditorModalComponent implements AfterViewInit, OnDestroy {
  api = inject(ApiService);
  host = inject(ElementRef) as ElementRef<HTMLElement>;
  sanitizer = inject(DomSanitizer);
  cdr = inject(ChangeDetectorRef);
  route = inject(ActivatedRoute);
  router = inject(Router);
  media = inject(MediaSelectionService);
  panels = inject(ContentEditorPanelRegistry);
  context = inject(ContentEditorContext);
  themeState = inject(ThemeEditorState);
  @ViewChild("surface", { static: true }) surface!: ElementRef<HTMLElement>;
  @ViewChild("canvasFrame") canvasFrame?: ElementRef<HTMLIFrameElement>;
  editor?: Editor;
  kind: "page" | "post" =
    this.route.snapshot.data["kind"] ||
    this.route.parent?.snapshot.data["kind"] ||
    "post";
  entry: Content;
  categories = "";
  tags = "";
  schedule = "";
  slugEdited = false;
  original = "";
  busy = signal(false);
  error = signal("");
  wordCount = signal(0);
  savedLabel = "Not saved yet";
  revisions = signal<any[]>([]);
  confirmLeave = false;
  leaveResolver: ((answer: boolean) => void) | null = null;
  timer?: ReturnType<typeof setInterval>;
  mode: "blocks" | "html" = "blocks";
  htmlSource = "";
  htmlBaseline = "";
  previousBodyOverflow = "";
  previousHtmlOverflow = "";
  libraryOpen = false;
  blockListOpen = false;
  viewMode: "canvas" | "outline" = "canvas";
  previewWidth = 1200;
  previewHtml: SafeHtml = "";
  previewError = "";
  previewNotice = "";
  toolbarVisible = false;
  toolbarHidden = false;
  toolbarPosition = { left: 16, top: 150, width: 600 };
  private toolbarFrame = 0;
  private toolbarEvents?: AbortController;
  private frameToolbarEvents?: AbortController;
  private canvasTimer?: ReturnType<typeof setTimeout>;
  private canvasSequence = 0;
  private destroyed = false;
  recentBlocks: string[] = [];
  private pointerCleanup?: () => void;
  get contentBlockDefinitions() {
    return this.themeState.blocks.filter((definition) => !definition.legacy);
  }
  get selectedBlockFields(): BlockField[] {
    if (this.themeState.node === this.themeState.root) return [];
    return (
      this.contentBlockDefinitions.find(
        (definition) => definition.type === this.themeState.node?.type,
      )?.fields || []
    ).filter(
      (field) =>
        modelFieldVisible(
          this.themeState.node?.type,
          this.themeState.node?.settings || {},
          field.key,
        ) &&
        !PICKER_FIELD_KEYS.has(field.key) &&
        !(
          this.themeState.node?.type === "core/container" &&
          field.key === "verticalAlign"
        ) &&
        !(
          field.key === "align" &&
          [
            "core/heading",
            "core/rich-text",
            "core/post-content",
            "core/content",
          ].includes(this.themeState.node?.type || "")
        ),
    );
  }
  constructor() {
    const id = this.route.snapshot.paramMap.get("id");
    const found = this.api
      .state()!
      .content.find((c) => c.id === id && c.kind === this.kind);
    this.entry = found
      ? structuredClone(found)
      : {
          id: "",
          kind: this.kind,
          title: "",
          slug: "",
          body: "",
          excerpt: "",
          status: "draft",
          publishAt: "",
          updatedAt: "",
          author: this.api.state()!.user.email,
        };
    this.entry.details = {
      featuredImageId: "",
      categories: [],
      tags: [],
      metaTitle: "",
      metaDescription: "",
      panelData: {},
      ...this.entry.details,
    };
    this.categories = this.entry.details.categories!.join(", ");
    this.tags = this.entry.details.tags!.join(", ");
    this.slugEdited = !!found;
    if (this.entry.publishAt)
      this.schedule = new Date(
        new Date(this.entry.publishAt).getTime() -
          new Date().getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16);
    this.context.content.set(this.entry);
    if (id && !found)
      this.error.set(
        "This entry could not be found. Close the editor to return to your content.",
      );
    effect(() => {
      this.themeState.selected();
      queueMicrotask(() => {
        if (this.destroyed) return;
        this.toolbarHidden = false;
        this.syncCanvasSelection();
        this.scheduleToolbarPosition();
      });
    });
  }
  ngAfterViewInit() {
    this.toolbarEvents = new AbortController();
    const options = { capture: true, signal: this.toolbarEvents.signal };
    document.addEventListener("scroll", this.scheduleToolbarPosition, options);
    window.addEventListener("resize", this.scheduleToolbarPosition, options);
    this.previousBodyOverflow = document.body.style.overflow;
    this.previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const api = this.api;
    const MediaNode = Node.create({
      name: "media",
      group: "block",
      atom: true,
      draggable: true,
      addAttributes: () => ({
        mediaId: {
          default: "",
          parseHTML: (element: HTMLElement) =>
            element.getAttribute("data-media-id") || "",
        },
        type: {
          default: "image",
          parseHTML: (element: HTMLElement) =>
            element.getAttribute("data-media-type") || "image",
        },
      }),
      parseHTML: () => [{ tag: "figure[data-media-id]" }],
      renderHTML: ({ node }) => {
        const m = api
          .state()
          ?.media.find((m) => m.id === node.attrs["mediaId"]);
        const type = m?.type || node.attrs["type"];
        const tag = type === "image" ? "img" : type;
        return [
          "figure",
          {
            "data-media-id": node.attrs["mediaId"],
            "data-media-type": type,
          },
          [
            tag,
            {
              src:
                "/api/media/" +
                encodeURIComponent(node.attrs["mediaId"]) +
                "/file",
              alt: m?.altText || "",
              ...(tag !== "img" ? { controls: "true" } : {}),
            },
          ],
          ["figcaption", {}, m?.caption || ""],
        ];
      },
    });
    this.editor = new Editor({
      element: this.surface.nativeElement,
      extensions: [StarterKit, MediaNode],
      content: this.entry.details?.richText || {
        type: "doc",
        content: this.entry.body.split(/\n\s*\n/).map((text) => ({
          type: "paragraph",
          content: text ? [{ type: "text", text }] : [],
        })),
      },
      editorProps: {
        attributes: {
          role: "textbox",
          "aria-label": "Rich text content",
          "aria-multiline": "true",
        },
      },
      onUpdate: () => {
        if (this.mode === "html") this.sync();
      },
    });
    this.sync();
    this.loadThemeBlocks();
    void this.loadActiveBlockDefinitions();
    this.htmlSource = this.editor.getHTML();
    this.htmlBaseline = this.htmlSource;
    this.original = this.fingerprint();
    this.savedLabel = this.entry.id ? "All changes saved" : "Not saved yet";
    this.loadRevisions();
    this.timer = setInterval(() => {
      if (
        this.dirty &&
        !this.busy() &&
        this.entry.title.trim() &&
        this.entry.slug
      )
        this.save(this.entry.status, true);
    }, 60000);
  }
  sync() {
    if (!this.editor) return;
    this.entry.details!.richText = this.editor.getJSON() as RichNode;
    this.entry.body = this.editor.getText();
    this.wordCount.set(
      this.entry.body.trim().split(/\s+/).filter(Boolean).length,
    );
  }
  loadThemeBlocks() {
    const content = Array.isArray(this.entry.details?.contentBlocks)
      ? structuredClone(this.entry.details.contentBlocks)
      : [
          {
            id: "blk_" + crypto.randomUUID(),
            type: "core/rich-text",
            settings: {
              html: this.editor?.getHTML() || "<p></p>",
              align: "left",
            },
          },
        ];
    const root: BlockNode = {
      id: "blk_" + crypto.randomUUID(),
      type: "core/container",
      settings: structuredClone(this.entry.details?.contentMain || {}),
      children: content,
    };
    const document: ThemeDocument = {
      manifest: {
        id: "content-editor",
        name: "Content",
        version: "1.0.0",
        author: "Colossal CMS",
        description: "Post and page blocks",
        license: "MIT",
        isCore: true,
        requires: { colossal: "*" },
        templates: [
          {
            id: "content",
            name: "Content",
            file: "",
            appliesTo: ["post", "page"],
          },
        ],
        parts: {},
        blocks: [],
        assets: { styles: [], scripts: [] },
      },
      templates: { content: root },
      parts: {},
      blocks: [],
      html: {},
      css: "",
      assets: {},
    };
    this.themeState.templateId = "content";
    this.themeState.rootLabel = "Main";
    this.themeState.onChange = () => this.syncThemeBlocks();
    this.themeState.load(document);
    this.themeState.selected.set(content[0]?.id || root.id);
  }
  async loadActiveBlockDefinitions() {
    const id = this.api.state()?.activeTheme?.manifest.id;
    if (!id) return;
    try {
      const record = await this.api.request("/themes/" + id);
      const current = this.themeState.document();
      if (current)
        this.themeState.document.set({
          ...current,
          blocks: record.published?.blocks || [],
        });
    } catch {
      // Built-in blocks remain available if the active theme cannot be loaded.
    }
  }
  syncThemeBlocks() {
    const content = this.themeState.root?.children;
    if (!content) return;
    this.entry.details!.contentBlocks = structuredClone(content);
    this.entry.details!.contentMain = structuredClone(
      this.themeState.root!.settings,
    );
    const plainText = (nodes: BlockNode[]): string =>
      nodes
        .map((node) =>
          [
            node.settings["text"],
            node.settings["html"],
            plainText(node.children || []),
          ]
            .filter(Boolean)
            .join(" "),
        )
        .join(" ");
    this.entry.body =
      new DOMParser().parseFromString(plainText(content), "text/html").body
        .textContent || "";
    this.wordCount.set(
      this.entry.body.trim().split(/\s+/).filter(Boolean).length,
    );
    this.scheduleCanvas();
  }
  toggleLibrary(open = !this.libraryOpen) {
    this.libraryOpen = open;
    if (open) this.blockListOpen = false;
    if (open)
      setTimeout(() =>
        document
          .querySelector<HTMLElement>(
            ".content-theme-library .block-library__search",
          )
          ?.focus(),
      );
  }
  toggleBlockList(open = !this.blockListOpen) {
    this.blockListOpen = open;
    if (open) this.libraryOpen = false;
  }
  setViewMode(mode: "canvas" | "outline") {
    this.viewMode = mode;
    this.toolbarVisible = false;
    setTimeout(this.scheduleToolbarPosition);
  }
  setPreviewWidth(width: number) {
    this.previewWidth = width;
    this.scheduleToolbarPosition();
  }
  private scheduleToolbarPosition = () => {
    if (this.toolbarFrame) return;
    this.toolbarFrame = requestAnimationFrame(() => {
      this.toolbarFrame = 0;
      this.positionBlockToolbar();
    });
  };
  private positionBlockToolbar() {
    const node = this.themeState.node;
    if (this.mode !== "blocks" || !node || this.themeState.protected(node)) {
      this.toolbarVisible = false;
      this.cdr.markForCheck();
      return;
    }
    let rect: DOMRect | undefined;
    let bounds: DOMRect | undefined;
    if (this.viewMode === "canvas") {
      const frame = this.canvasFrame?.nativeElement;
      const block = frame?.contentDocument?.querySelector<HTMLElement>(
        `[data-block-id="${node.id}"]`,
      );
      if (frame) {
        const f = frame.getBoundingClientRect();
        bounds = this.host.nativeElement
          .querySelector<HTMLElement>(".editor-writing")
          ?.getBoundingClientRect();
        if (block) {
          const b = block.getBoundingClientRect();
          rect = new DOMRect(f.left + b.left, f.top + b.top, b.width, b.height);
        }
      }
    } else {
      const outline = this.host.nativeElement.querySelector<HTMLElement>(
        `[data-outline-id="${node.id}"] > .theme-tree-row`,
      );
      rect = outline?.getBoundingClientRect();
      bounds = this.host.nativeElement
        .querySelector<HTMLElement>(".editor-writing")
        ?.getBoundingClientRect();
    }
    bounds ||= this.host.nativeElement
      .querySelector<HTMLElement>(".editor-writing")
      ?.getBoundingClientRect();
    if (!bounds) {
      this.toolbarVisible = false;
      this.cdr.markForCheck();
      return;
    }
    const canvasTop =
      this.host.nativeElement
        .querySelector<HTMLElement>(
          this.viewMode === "canvas"
            ? ".content-canvas-scroll"
            : ".content-theme-outline",
        )
        ?.getBoundingClientRect().top ?? bounds.top;
    const fallback = !rect;
    rect ||= new DOMRect(
      bounds.left + 12,
      canvasTop + 12,
      bounds.width - 24,
      36,
    );
    const width = Math.max(
      220,
      Math.min(760, bounds.width - 24, window.innerWidth - 24),
    );
    const canvasAnchorTop = Math.max(
      bounds.top + 8,
      Math.min(canvasTop + 8, bounds.bottom - 54),
    );
    this.toolbarPosition = {
      width,
      left: Math.max(
        bounds.left + 12,
        Math.min(
          rect.left + rect.width / 2 - width / 2,
          bounds.right - width - 12,
          window.innerWidth - width - 12,
        ),
      ),
      top:
        fallback || rect.bottom < bounds.top || rect.top > bounds.bottom
          ? canvasAnchorTop
          : Math.max(
              canvasAnchorTop,
              Math.min(
                rect.top > bounds.top + 60
                  ? rect.top - 54
                  : rect.top + Math.min(rect.height, 48) + 8,
                Math.min(bounds.bottom, window.innerHeight) - 54,
              ),
            ),
    };
    this.toolbarVisible = true;
    this.cdr.markForCheck();
  }
  dismissBlockToolbar() {
    this.toolbarHidden = true;
    this.toolbarVisible = false;
    this.cdr.markForCheck();
  }
  scheduleCanvas() {
    clearTimeout(this.canvasTimer);
    this.canvasTimer = setTimeout(() => void this.refreshCanvas(), 300);
  }
  async refreshCanvas() {
    if (this.destroyed || !this.themeState.root) return;
    const sequence = ++this.canvasSequence;
    try {
      const rendered = await this.api.request("/admin/content/render", "POST", {
        content: this.entry,
        contentBlocks: this.themeState.root.children || [],
        mainSettings: this.themeState.root.settings,
        mainId: this.themeState.root.id,
      });
      if (this.destroyed || sequence !== this.canvasSequence) return;
      this.previewError = "";
      this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}html,body{min-height:100%}' +
          rendered.css +
          "</style></head><body " +
          themeBodyAttributes(rendered.body) +
          ">" +
          rendered.html +
          "</body></html>",
      );
      this.cdr.markForCheck();
    } catch (e) {
      if (sequence === this.canvasSequence) {
        this.previewError = (e as Error).message;
        this.cdr.markForCheck();
      }
    }
  }
  enhanceContentCanvas() {
    const doc = this.canvasFrame?.nativeElement.contentDocument;
    if (!doc?.body) return;
    hydrateModels(doc);
    hydrateSliders(doc, true);
    this.frameToolbarEvents?.abort();
    this.frameToolbarEvents = new AbortController();
    doc.addEventListener("scroll", this.scheduleToolbarPosition, {
      capture: true,
      signal: this.frameToolbarEvents.signal,
    });
    const style = doc.createElement("style");
    style.textContent =
      ".cl-content-editable{cursor:pointer}.cl-content-editable:hover{outline:1px dashed #51906b;outline-offset:2px}.cl-content-selected{outline:2px solid #2f6b4f!important;outline-offset:2px}.cl-content-drop-target{outline:3px dashed #2f6b4f!important;outline-offset:2px}.theme-root [data-block-id].cl-overlay-block{pointer-events:auto}";
    doc.head.append(style);
    const mark = (nodes: BlockNode[]) => {
      for (const node of nodes) {
        doc
          .querySelector<HTMLElement>(`[data-block-id="${node.id}"]`)
          ?.classList.add("cl-content-editable");
        mark(node.children || []);
      }
    };
    if (this.themeState.root) mark([this.themeState.root]);
    this.syncCanvasSelection();
    this.scheduleToolbarPosition();
    doc.addEventListener("submit", (event) => event.preventDefault());
    doc.addEventListener("click", (event) => {
      // Theme links belong to the preview, never navigate its iframe away from the draft.
      event.preventDefault();
      const clicked = event.target as Element;
      const target = clicked.closest<HTMLElement>(".cl-content-editable");
      const id = target?.dataset["blockId"];
      if (!id || !this.themeState.find(id)) {
        this.previewNotice = "";
        this.cdr.markForCheck();
        return;
      }
      this.previewNotice = "";
      this.themeState.selected.set(id);
      this.toolbarHidden = false;
      this.syncCanvasSelection();
      this.scheduleToolbarPosition();
    });
  }
  syncCanvasSelection() {
    const doc = this.canvasFrame?.nativeElement.contentDocument;
    if (!doc) return;
    doc
      .querySelectorAll(".cl-content-selected")
      .forEach((el) => el.classList.remove("cl-content-selected"));
    doc
      .querySelector<HTMLElement>(
        `[data-block-id="${this.themeState.selected()}"]`,
      )
      ?.classList.add("cl-content-selected");
  }
  insertThemeBlock(type: string) {
    if (
      !this.contentBlockDefinitions.some(
        (definition) => definition.type === type,
      )
    )
      return;
    this.themeState.insert(type);
    this.recentBlocks = [
      type,
      ...this.recentBlocks.filter((item) => item !== type),
    ].slice(0, 5);
  }
  libraryPointerStart({ event, type }: { event: PointerEvent; type: string }) {
    if (event.button !== 0) return;
    this.pointerCleanup?.();
    const source = event.currentTarget as HTMLElement;
    const owner = source.ownerDocument;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const transfer = new DataTransfer();
    transfer.setData("application/x-colossal-block", JSON.stringify({ type }));
    let active = false;
    let target: HTMLElement | null = null;
    let canvasTarget: { parentId: string; index: number } | null = null;
    let canvasHighlight: HTMLElement | null = null;
    const suppressClick = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const locate = (e: PointerEvent) => {
      target?.classList.remove("over");
      canvasHighlight?.classList.remove("cl-content-drop-target");
      canvasHighlight = null;
      canvasTarget = null;
      target =
        owner
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>(
            ".content-theme-outline .theme-drop-zone, .content-theme-outline .theme-tree-row",
          ) || null;
      if (target) {
        target.dispatchEvent(
          new DragEvent("dragover", {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
            clientX: e.clientX,
            clientY: e.clientY,
          }),
        );
      } else {
        const frame = this.canvasFrame?.nativeElement;
        const frameDocument = frame?.contentDocument;
        const hit = owner.elementFromPoint(e.clientX, e.clientY);
        if (frame && frameDocument && hit === frame) {
          const rect = frame.getBoundingClientRect();
          const inside = frameDocument.elementFromPoint(
            e.clientX - rect.left - frame.clientLeft,
            e.clientY - rect.top - frame.clientTop,
          );
          const element = inside?.closest<HTMLElement>(".cl-content-editable");
          const block = element?.dataset["blockId"]
            ? this.themeState.find(element.dataset["blockId"])
            : undefined;
          const root = this.themeState.root;
          if (root) {
            let parent = block?.children
              ? block
              : block && this.themeState.parent(block.id);
            parent ||= root;
            const index = block?.children
              ? block.children.length
              : block && parent.children
                ? parent.children.indexOf(block) +
                  (inside &&
                  element &&
                  e.clientY - rect.top >=
                    element.getBoundingClientRect().top +
                      element.getBoundingClientRect().height / 2
                    ? 1
                    : 0)
                : parent.children?.length || 0;
            if (this.themeState.canDrop(parent.id, index, { type })) {
              canvasTarget = { parentId: parent.id, index };
              canvasHighlight = element || null;
              canvasHighlight?.classList.add("cl-content-drop-target");
            }
          }
        }
      }
    };
    this.pointerCleanup = () => {
      controller.abort();
      target?.classList.remove("over");
      canvasHighlight?.classList.remove("cl-content-drop-target");
      this.themeState.dragSource = null;
      if (source.hasPointerCapture(event.pointerId))
        source.releasePointerCapture(event.pointerId);
      if (active)
        setTimeout(
          () => source.removeEventListener("click", suppressClick, true),
          250,
        );
      this.pointerCleanup = undefined;
    };
    owner.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerId !== event.pointerId) return;
        if (!active) {
          if (
            Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < 5
          )
            return;
          active = true;
          source.addEventListener("click", suppressClick, true);
          this.themeState.dragSource = { type };
          try {
            source.setPointerCapture(event.pointerId);
          } catch {
            /* Synthetic pointer. */
          }
        }
        e.preventDefault();
        locate(e);
      },
      options,
    );
    owner.addEventListener(
      "pointerup",
      (e) => {
        if (e.pointerId !== event.pointerId) return;
        if (active) {
          e.preventDefault();
          locate(e);
          target?.dispatchEvent(
            new DragEvent("drop", {
              bubbles: true,
              cancelable: true,
              dataTransfer: transfer,
              clientX: e.clientX,
              clientY: e.clientY,
            }),
          );
          if (canvasTarget)
            this.themeState.dropBlock(
              canvasTarget.parentId,
              canvasTarget.index,
              { type },
            );
        }
        this.pointerCleanup?.();
      },
      options,
    );
    owner.addEventListener(
      "pointercancel",
      () => this.pointerCleanup?.(),
      options,
    );
    owner.defaultView?.addEventListener(
      "blur",
      () => this.pointerCleanup?.(),
      options,
    );
  }
  async selectBlockMedia(field: BlockField) {
    const node = this.themeState.node;
    if (!node) return;
    const accept =
      field.type === "image"
        ? ["image"]
        : field.type === "model"
          ? ["model"]
          : ["image", "audio", "video"];
    const [item] = await this.media.open({
      accept: accept as ("image" | "audio" | "video" | "model")[],
    });
    if (item) this.themeState.set(field.key, item.id);
  }
  replaceBlockMedia(type: string) {
    const portrait =
      this.themeState.node?.type === "core/gltf" &&
      this.themeState.node.settings["source"] === "portrait";
    void this.selectBlockMedia({
      key: portrait ? "portraitImage" : "mediaId",
      label: "Media file",
      type,
    });
  }
  formatBlockText(key: string) {
    const node = this.themeState.node;
    if (!node) return;
    const doc = this.canvasFrame?.nativeElement.contentDocument;
    const block = doc?.querySelector<HTMLElement>(
      `[data-block-id="${node.id}"]`,
    );
    const selection = doc?.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const selected =
      this.viewMode === "canvas" &&
      range &&
      !range.collapsed &&
      block?.contains(range.commonAncestorContainer) &&
      ["core/heading", "core/rich-text"].includes(node.type);
    if (!selected) {
      this.themeState.set(key, !node.settings[key]);
      return;
    }
    const tag = (
      {
        bold: "strong",
        italic: "em",
        underline: "u",
        strike: "s",
        inlineCode: "code",
        link: "a",
      } as Record<string, string>
    )[key];
    if (!tag) return;
    const wrapper = doc!.createElement(tag);
    if (key === "link") {
      const href = prompt("Link URL (HTTPS, mailto, or local path):");
      if (
        !href ||
        !/^(https:\/\/|mailto:|\/(?!\/))/.test(href) ||
        /[\x00-\x20]/.test(href)
      )
        return;
      wrapper.setAttribute("href", href);
      wrapper.setAttribute("rel", "noopener noreferrer");
    }
    wrapper.appendChild(range!.extractContents());
    range!.insertNode(wrapper);
    selection!.removeAllRanges();
    const content =
      node.type === "core/heading"
        ? block!.querySelector("h1,h2,h3,h4,h5,h6")
        : block;
    if (content) this.themeState.set("html", content.innerHTML);
  }
  get sourceWordCount() {
    return this.htmlSource
      .replace(/<[^>]*>/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }
  switchMode(next: "blocks" | "html") {
    if (next === this.mode || !this.editor) return;
    this.error.set("");
    if (next === "html") {
      let richText = ["core/rich-text", "core/html"].includes(
        this.themeState.node?.type || "",
      )
        ? this.themeState.node
        : this.findRichText(this.themeState.root?.children || []);
      if (!richText) {
        const root = this.themeState.root;
        if (!root) return;
        this.themeState.insert(
          "core/rich-text",
          root.id,
          root.children?.length,
        );
        richText = this.themeState.node;
      }
      if (!richText) return;
      this.themeState.selected.set(richText.id);
      this.htmlSource = String(richText.settings["html"] || "");
      this.htmlBaseline = this.htmlSource;
      this.mode = "html";
      this.toolbarVisible = false;
      return;
    }
    try {
      this.applyHtmlSource();
      this.mode = "blocks";
      setTimeout(this.scheduleToolbarPosition);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  findRichText(nodes: BlockNode[]): BlockNode | undefined {
    for (const node of nodes) {
      if (node.type === "core/rich-text") return node;
      const nested = this.findRichText(node.children || []);
      if (nested) return nested;
    }
    return undefined;
  }
  applyHtmlSource() {
    if (!this.editor) return;
    if (this.htmlSource.length > 100000)
      throw new Error("HTML source is too long (100,000 characters maximum).");
    const parsed = new DOMParser().parseFromString(
      this.htmlSource,
      "text/html",
    );
    if (parsed.querySelector("script,style,iframe,object,embed,form,svg,math"))
      throw new Error(
        "Remove scripts, embeds, and forms from the HTML source.",
      );
    for (const element of Array.from(parsed.body.querySelectorAll("*")))
      for (const attr of Array.from(element.attributes))
        if (
          attr.name.startsWith("on") ||
          (["href", "src"].includes(attr.name) &&
            /^\s*(javascript:|data:)/i.test(attr.value))
        )
          throw new Error(
            "Remove unsafe links or event attributes from the HTML source.",
          );
    if (this.themeState.node?.type === "core/rich-text") {
      // Keep the older structured field in sync without replacing the block's source.
      this.editor.commands.setContent(this.htmlSource);
      this.sync();
    }
    if (this.themeState.node?.settings["html"] !== this.htmlSource)
      this.themeState.set("html", this.htmlSource);
    this.syncThemeBlocks();
    this.htmlBaseline = this.htmlSource;
  }
  fingerprint() {
    return JSON.stringify({
      templateId: this.entry.templateId,
      title: this.entry.title,
      slug: this.entry.slug,
      excerpt: this.entry.excerpt,
      body: this.entry.body,
      status: this.entry.status,
      author: this.entry.author,
      details: this.entry.details,
      categories: this.categories,
      tags: this.tags,
      schedule: this.schedule,
    });
  }
  get dirty() {
    return (
      !!this.original &&
      (this.fingerprint() !== this.original ||
        (this.mode === "html" && this.htmlSource !== this.htmlBaseline))
    );
  }
  get availableTemplates() {
    return (
      this.api
        .state()
        ?.activeTheme?.manifest.templates.filter((t) =>
          t.appliesTo.includes(this.templateScope),
        ) || []
    );
  }
  get templateScope() {
    const s = this.api.state()?.settings;
    return this.kind === "page" &&
      this.entry.id &&
      this.entry.id === s?.postsPageId
      ? "post-index"
      : this.kind === "page" &&
          this.entry.id &&
          this.entry.id === s?.notFoundPageId
        ? "404"
        : this.kind === "page" &&
            this.entry.id &&
            this.entry.id === s?.homePageId
          ? "home"
          : this.kind;
  }
  get defaultTemplateName() {
    const list = this.api.state()?.activeTheme?.manifest.templates || [];
    return (
      (
        list.find(
          (t) => t.isTypeDefault && t.appliesTo.includes(this.templateScope),
        ) || list.find((t) => t.isDefault)
      )?.name || "Core fallback"
    );
  }
  get selectedTemplateName() {
    return (
      this.availableTemplates.find((t) => t.id === this.entry.templateId)
        ?.name || this.defaultTemplateName
    );
  }
  get templateWarning() {
    return this.entry.templateId &&
      !this.availableTemplates.some((t) => t.id === this.entry.templateId)
      ? "This " +
          this.kind +
          " used '" +
          this.entry.templateId +
          "', which is not available in the active theme. Falling back to '" +
          this.defaultTemplateName +
          "'."
      : "";
  }
  get featured() {
    return this.api
      .state()!
      .media.find((m) => m.id === this.entry.details?.featuredImageId);
  }
  get categoryOptions() {
    return [
      ...new Set(
        this.api.state()!.content.flatMap((c) => c.details?.categories || []),
      ),
    ];
  }
  get tagOptions() {
    return [
      ...new Set(
        this.api.state()!.content.flatMap((c) => c.details?.tags || []),
      ),
    ];
  }
  get authors() {
    return [
      ...new Set([
        this.entry.author,
        this.api.state()!.user.email,
        ...this.api.state()!.members.map((m) => m.email),
      ]),
    ];
  }
  autoSlug() {
    if (!this.slugEdited)
      this.entry.slug = this.entry.title
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    this.scheduleCanvas();
  }
  async selectFeatured() {
    const [item] = await this.media.open({
      accept: ["image"],
      initialSelectionIds: this.entry.details?.featuredImageId
        ? [this.entry.details.featuredImageId]
        : [],
    });
    if (item) this.entry.details!.featuredImageId = item.id;
  }
  setPanel(key: string, value: string) {
    this.entry.details!.panelData = {
      ...this.entry.details!.panelData,
      [key]: value,
    };
  }
  async loadRevisions() {
    if (this.entry.id)
      try {
        this.revisions.set(
          await this.api.request(
            "/admin/content/" + this.entry.id + "/revisions",
          ),
        );
      } catch (e) {
        this.error.set((e as Error).message);
      }
  }
  restore(snapshot: Content) {
    const id = this.entry.id,
      updatedAt = this.entry.updatedAt;
    this.entry = { ...structuredClone(snapshot), id, updatedAt };
    this.entry.details ??= {};
    this.entry.details.panelData ??= {};
    this.categories = (this.entry.details.categories || []).join(", ");
    this.tags = (this.entry.details.tags || []).join(", ");
    this.schedule = this.entry.publishAt
      ? new Date(
          new Date(this.entry.publishAt).getTime() -
            new Date().getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";
    this.editor?.commands.setContent(
      this.entry.details.richText || {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: this.entry.body || " " }],
          },
        ],
      },
    );
    this.sync();
    this.loadThemeBlocks();
    this.htmlSource = String(
      this.themeState.node?.settings["html"] || this.editor?.getHTML() || "",
    );
    this.htmlBaseline = this.htmlSource;
    this.context.content.set(this.entry);
    this.savedLabel = "Revision restored · save to apply";
  }
  async save(status: Content["status"], autosave = false) {
    if (
      this.busy() ||
      (this.route.snapshot.paramMap.get("id") && !this.entry.id)
    )
      return;
    if (this.mode === "html") {
      try {
        this.applyHtmlSource();
      } catch (e) {
        this.error.set((e as Error).message);
        return;
      }
    }
    this.syncThemeBlocks();
    this.busy.set(true);
    this.error.set("");
    try {
      if (!this.entry.title.trim() || !this.entry.slug)
        throw new Error("Add a title and URL slug before saving.");
      this.entry.details!.categories = this.categories
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      this.entry.details!.tags = this.tags
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const publishAt =
        status === "scheduled"
          ? new Date(this.schedule).toISOString()
          : this.entry.publishAt;
      const savedFingerprint = JSON.parse(this.fingerprint());
      savedFingerprint.status = autosave ? this.entry.status : status;
      const result = await this.api.request("/admin/content", "POST", {
        ...this.entry,
        status,
        publishAt,
        autosave,
        expectedUpdatedAt: this.entry.updatedAt,
      });
      const wasNew = !this.entry.id;
      this.entry.id = result.id;
      this.entry.updatedAt = result.updatedAt;
      this.entry.status = autosave ? this.entry.status : status;
      this.original = JSON.stringify(savedFingerprint);
      await this.api.load();
      await this.loadRevisions();
      this.savedLabel = result.autosaved
        ? "Autosaved revision · live version unchanged"
        : autosave
          ? "Draft autosaved"
          : "All changes saved";
      if (!autosave)
        this.api.toast(
          status === "published"
            ? "Your " + this.kind + " is published."
            : status === "scheduled"
              ? "Publication scheduled."
              : "Changes saved.",
        );
      if (wasNew)
        await this.router.navigate(
          ["/" + (this.kind === "page" ? "pages" : "posts"), "edit", result.id],
          { replaceUrl: true },
        );
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
  canLeave(): boolean | Promise<boolean> {
    if (!this.dirty) return true;
    this.confirmLeave = true;
    return new Promise((resolve) => (this.leaveResolver = resolve));
  }
  resolveLeave(answer: boolean) {
    this.confirmLeave = false;
    this.leaveResolver?.(answer);
    this.leaveResolver = null;
  }
  close() {
    this.router.navigate(["/" + (this.kind === "page" ? "pages" : "posts")]);
  }
  @HostListener("document:keydown", ["$event"]) key(event: KeyboardEvent) {
    if (this.media.options()) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      this.save("draft");
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      this.save("published");
    }
    if (this.mode === "blocks" && (event.ctrlKey || event.metaKey)) {
      if (
        (event.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      const key = event.key.toLowerCase();
      if (["1", "2", "3"].includes(key)) {
        event.preventDefault();
        this.setPreviewWidth([1200, 768, 390][Number(key) - 1]);
      } else if (key === "b") {
        event.preventDefault();
        this.toggleLibrary();
      } else if (event.shiftKey && (key === "c" || key === "o")) {
        event.preventDefault();
        this.setViewMode(key === "c" ? "canvas" : "outline");
      } else if (key === "z" || key === "y") {
        event.preventDefault();
        if (key === "y" || event.shiftKey) this.themeState.redo();
        else this.themeState.undo();
      }
    }
    if (event.key === "Escape" && !this.confirmLeave) {
      if (this.libraryOpen) this.toggleLibrary(false);
      else if (this.blockListOpen) this.toggleBlockList(false);
      else this.close();
    }
  }
  @HostListener("window:beforeunload", ["$event"]) unload(
    event: BeforeUnloadEvent,
  ) {
    if (this.dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    clearTimeout(this.canvasTimer);
    this.toolbarEvents?.abort();
    this.frameToolbarEvents?.abort();
    cancelAnimationFrame(this.toolbarFrame);
    this.pointerCleanup?.();
    clearInterval(this.timer);
    this.editor?.destroy();
    document.body.style.overflow = this.previousBodyOverflow;
    document.documentElement.style.overflow = this.previousHtmlOverflow;
    this.context.content.set(null);
  }
}
