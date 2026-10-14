import { PatternLibraryComponent } from "./pattern-library.component";
import { contentTemplateScope } from "./content-template-scope";
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
import { ThemeEditorState } from "./theme-editor-state";
import { BlockListDrawerComponent } from "./block-list-drawer.component";
import { EditorAutomationApi } from "./editor-automation.service";
import { ThemeOutlineApi } from "./theme-outline-api";
import { hydrateSliders } from "./swiper-host";
import { hydrateModels } from "./gltf-host";
import { modelFieldVisible } from "./model-field-visibility";
import { themeBodyAttributes } from "./theme-body";
import { syncEditorCanvasAppearance } from "./editor-canvas-appearance";
import { EditorCanvasUpdates } from "./editor-canvas-updates";
import { InlineTextCanvasEditor } from "./inline-text-canvas-editor";
import { HtmlCanvasEditor } from "./html-canvas-editor";
import { canvasBlockId } from "./context-blocks";
import { BlockLibraryDrawerComponent } from "./block-library-drawer.component";
import { EditorShellComponent, EditorPanel } from "./editor-shell.component";
import { EditorDialogComponent } from "./editor-dialog.component";
import { BlockIconComponent } from "./block-icon.component";
import { MenuPagePickerComponent } from "./menu-page-picker.component";
import { hydrateMenus, revealEditorMenu } from "./menu-host";
import { IconPickerComponent } from "./icon-picker.component";
import { ContextualBlockToolbarComponent } from "./contextual-block-toolbar.component";
import { toolbarMovement } from "./toolbar-movement";
import { installEditorBlockPlaceholders } from "./editor-block-placeholders";
import { BlockField, BlockNode, ThemeDocument } from "./theme-models";
import {
  AppearancePickerPanelComponent,
  PICKER_FIELD_KEYS,
} from "./pickers/appearance-picker-panel.component";
import { Content, RichNode } from "./models";
import { SeoPanelComponent } from "./seo-panel.component";
@Component({
  selector: "cl-content-editor-modal",
  standalone: true,
  imports: [
    SeoPanelComponent,
    FormsModule,
    DatePipe,
    NgComponentOutlet,
    IconComponent,
    BlockListDrawerComponent,
    BlockLibraryDrawerComponent,
    PatternLibraryComponent,
    EditorShellComponent,
    EditorDialogComponent,
    BlockIconComponent,
    IconPickerComponent,
    MenuPagePickerComponent,
    ContextualBlockToolbarComponent,
    AppearancePickerPanelComponent,
  ],
  providers: [ThemeEditorState, ThemeOutlineApi, EditorAutomationApi],
  template: `
    <section
      class="content-editor-fullscreen block-workspace"
      [class.is-dragging]="pointerDragging"
      aria-label="Post or page editor"
    >
      <cl-editor-shell
        #editorShell
        [kind]="kind === 'post' ? 'Post' : 'Page'"
        [title]="entry.title || 'Untitled ' + kind"
        [templateName]="selectedTemplateName"
        [status]="dirty ? 'Unsaved changes' : savedLabel"
        [busy]="busy()"
        [saveLabel]="entry.status === 'draft' ? 'Save draft' : 'Save changes'"
        [width]="previewWidth"
        [canUndo]="!!themeState.past.length"
        [canRedo]="!!themeState.future.length"
        (leave)="close()"
        (save)="save(entry.status)"
        (preview)="previewContent()"
        (undo)="themeState.undo()"
        (redo)="themeState.redo()"
        (widthChange)="setPreviewWidth($event)"
        (panelChange)="sidebarChanged($event)"
        (layoutChange)="scheduleToolbarPosition()"
      >
        <div
          editor-blocks
          id="block-library-drawer"
          class="content-sidebar-blocks"
        >
          <cl-block-library-drawer
            [open]="libraryOpen"
            [columnsSelected]="themeState.node?.type === 'core/columns'"
            [blocks]="contentBlockDefinitions"
            [recent]="recentBlocks"
            (choose)="insertThemeBlock($event)"
            (pointerStart)="libraryPointerStart($event)"
            (dismiss)="toggleLibrary(false)"
          />
        </div>
        <div editor-patterns>
          <cl-pattern-library
            [open]="editorShell.sidebarOpen && editorShell.panel === 'patterns'"
            [document]="themeState.document()"
          />
        </div>
        <div
          editor-structure
          id="block-list-drawer"
          class="content-theme-outline"
        >
          <cl-block-list-drawer
            [view]="editorShell.panel === 'list' ? 'list' : 'outline'"
            (settingsOpen)="editorShell.setPanel('inspector')"
          />
        </div>
        <div
          editor-inspector
          class="editor-options"
          aria-label="Content options"
        >
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
              @for (field of selectedBlockFields; track field.key) {
                <label
                  class="theme-field block-setting-field"
                  [class.block-setting-checkbox]="field.type === 'checkbox'"
                  [class.block-setting-source]="
                    (themeState.node.type === 'core/rich-text' ||
                      themeState.node.type === 'core/html') &&
                    field.key === 'html'
                  "
                >
                  @if (field.type !== "checkbox") {
                    <span class="block-setting-label">{{ field.label }}</span>
                  }
                  <span class="block-setting-control">
                    @switch (field.type) {
                      @case ("menu-page") {
                        <cl-menu-page-picker
                          [value]="themeState.node.settings[field.key]"
                          (valueChange)="themeState.set(field.key, $event)"
                        />
                      }
                      @case ("icon") {
                        <cl-icon-picker
                          [suggestions]="
                            field.key === 'mobileIcon'
                              ? ['bars', 'list', 'grid', 'chevron-down']
                              : []
                          "
                          [value]="
                            themeState.node.settings[field.key] ?? field.default
                          "
                          (valueChange)="themeState.set(field.key, $event)"
                        />
                      }
                      @case ("select") {
                        <select
                          [ngModel]="
                            themeState.node.settings[field.key] ?? field.default
                          "
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
                          [ngModel]="
                            themeState.node.settings[field.key] ?? field.default
                          "
                          (ngModelChange)="themeState.set(field.key, $event)"
                        />
                        <span class="block-setting-label">{{
                          field.label
                        }}</span>
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
                          [attr.min]="field.min ?? null"
                          [attr.max]="field.max ?? null"
                          [attr.step]="field.step ?? null"
                          [ngModel]="
                            themeState.node.settings[field.key] ?? field.default
                          "
                          (ngModelChange)="themeState.set(field.key, $event)"
                        />
                      }
                    }
                  </span>
                  @if (field.help) {
                    <span class="field-note">{{ field.help }}</span>
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
                  class="theme-field block-setting-field block-setting-checkbox"
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
            @if (panel.id === "template") {
              <h3 class="editor-inspector-section-label">Template</h3>
            }
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
                    <label class="theme-field block-setting-field"
                      ><span class="block-setting-label">Theme template</span
                      ><select
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
                    @if (seoEnabled) {
                      <cl-seo-panel
                        [entry]="entry"
                        (slugChange)="slugEdited = true"
                      />
                    } @else {
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
        </div>
        <div editor-canvas class="editor-writing">
          @if (error()) {
            <div class="editor-inline-notice" role="alert">{{ error() }}</div>
          }
          <div class="content-document-bar">
            <input
              class="editor-title-input"
              aria-label="Title"
              [(ngModel)]="entry.title"
              (ngModelChange)="autoSlug()"
              [placeholder]="'Untitled ' + kind"
              maxlength="200"
            />
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
                Blocks</button
              ><button
                type="button"
                [attr.aria-pressed]="mode === 'html'"
                (click)="switchMode('html')"
              >
                HTML
              </button>
            </div>
          </div>
          @if (mode === "blocks" && themeState.root) {
            <div class="content-canvas-scroll">
              <iframe
                #canvasFrame
                class="content-live-preview"
                title="Live post or page canvas"
                sandbox="allow-same-origin"
                [style.width]="previewWidth ? previewWidth + 'px' : '100%'"
                [srcdoc]="previewHtml"
                (load)="enhanceContentCanvas()"
              ></iframe>
            </div>
          }
          <div
            #surface
            class="rich-editor-surface content-editor-parser"
            hidden
          ></div>
          @if (mode === "html") {
            <div class="content-html-workspace">
              <label class="editor-html-label" for="editor-html-source"
                >HTML source</label
              ><textarea
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
                  themeState.node?.type === "core/paragraph"
                    ? "Paragraph"
                    : "Formatted HTML"
                }}
                block as HTML. Safe block markup is preserved when switching
                views or saving.
              </p>
            </div>
          }
          <div class="content-canvas-status">
            <span
              >{{ mode === "html" ? sourceWordCount : wordCount() }} words ·
              {{ themeState.root?.children?.length || 0 }} blocks</span
            >
            @if (previewError) {
              <span role="alert">{{ previewError }}</span>
            }
            @if (previewNotice) {
              <span role="status">{{ previewNotice }}</span>
            }
            <span>{{
              previewWidth ? previewWidth + " px" : "Fit canvas"
            }}</span>
          </div>
          @if (
            mode === "blocks" &&
            toolbarVisible &&
            !toolbarHidden &&
            themeState.node &&
            !themeState.protected(themeState.node)
          ) {
            <cl-contextual-block-toolbar
              [moveLayout]="toolbarMoveLayout"
              [style.position]="'fixed'"
              [style.z-index]="50"
              [style.left.px]="toolbarPosition.left"
              [style.top.px]="toolbarPosition.top"
              [style.width.px]="toolbarPosition.width"
              (dismiss)="dismissBlockToolbar()"
              (format)="formatBlockText($event)"
              (replace)="replaceBlockMedia($event)"
            />
          }
        </div>
        <div editor-templates class="editor-template-picker">
          <p class="editor-menu-note">
            Choose the template used when this content is displayed on your
            site. The canvas shows this entry’s content.
          </p>
          <input
            aria-label="Search templates"
            class="editor-template-search"
            placeholder="Search templates…"
            [(ngModel)]="templateSearch"
          />
          <div class="editor-template-grid">
            <button
              class="editor-template-card"
              [attr.aria-pressed]="!entry.templateId"
              (click)="
                entry.templateId = '';
                scheduleCanvas();
                editorShell.closeOverlay()
              "
            >
              <cl-block-icon icon="fas fa-file-alt" /><span>Automatic</span
              ><small>{{ defaultTemplateName }}</small>
            </button>
            @for (t of availableTemplates; track t.id) {
              @if (
                t.name.toLowerCase().includes(templateSearch.toLowerCase())
              ) {
                <button
                  class="editor-template-card"
                  [attr.aria-pressed]="entry.templateId === t.id"
                  (click)="
                    entry.templateId = t.id;
                    scheduleCanvas();
                    editorShell.closeOverlay()
                  "
                >
                  <cl-block-icon icon="fas fa-file-alt" /><span>{{
                    t.name
                  }}</span
                  ><small>{{ t.appliesTo.join(", ") }}</small>
                </button>
              }
            }
          </div>
          @if (templateWarning) {
            <p role="status">{{ templateWarning }}</p>
          }
        </div>
        <div editor-metadata class="editor-metadata-form">
          @if (activeThemeDocument; as doc) {
            @if (api.state()?.user?.role === "admin") {
              <label
                >Theme name<input
                  [(ngModel)]="doc.manifest.name"
                  maxlength="120" /></label
              ><label
                >Author<input
                  [(ngModel)]="doc.manifest.author"
                  maxlength="120" /></label
              ><label
                >Description<textarea
                  [(ngModel)]="doc.manifest.description"
                  rows="3"
                  maxlength="1000"
                ></textarea></label
              ><label
                >License<input
                  [(ngModel)]="doc.manifest.license"
                  maxlength="120" /></label
              ><button
                class="editor-save"
                [disabled]="themeMetadataBusy"
                (click)="saveThemeMetadata()"
              >
                {{ themeMetadataBusy ? "Saving…" : "Save theme details" }}
              </button>
              <p class="editor-menu-note">
                Saves theme metadata as a theme draft. Publish it from the Theme
                Editor.
              </p>
            } @else {
              <h3>{{ doc.manifest.name }}</h3>
              <p>{{ doc.manifest.description }}</p>
              <p class="editor-menu-note">
                By {{ doc.manifest.author }} · {{ doc.manifest.version }}
              </p>
            }
          } @else {
            <p class="editor-menu-note">Theme details are loading.</p>
          }
        </div>
        <div editor-settings class="editor-settings-menu">
          <button
            class="editor-menu-row editor-publish"
            [disabled]="busy()"
            (click)="
              editorShell.closeOverlay();
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
              entry.status === "scheduled"
                ? "Schedule"
                : entry.status === "pending"
                  ? "Submit for review"
                  : "Publish"
            }}</button
          ><button
            class="editor-menu-row"
            (click)="
              switchMode(mode === 'html' ? 'blocks' : 'html');
              editorShell.closeOverlay()
            "
          >
            {{ mode === "html" ? "Edit with blocks" : "Edit HTML" }}</button
          ><button
            class="editor-menu-row"
            (click)="
              editorShell.setPanel('inspector'); editorShell.closeOverlay()
            "
          >
            Content settings
          </button>
        </div>
        <cl-editor-dialog #editorDialog editor-dialogs />
      </cl-editor-shell>
    </section>
  `,
})
export class ContentEditorModalComponent implements AfterViewInit, OnDestroy {
  get seoEnabled() {
    return !!this.api
      .state()
      ?.plugins.some((p) => p.id === "com.colossal.seo" && p.active);
  }
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
  automation = inject(EditorAutomationApi);
  private textEditor = new InlineTextCanvasEditor(this.themeState, {
    blocks: () =>
      this.themeState.blocks.filter(
        (block) =>
          !block.pluginId ||
          this.api
            .state()
            ?.plugins.some(
              (plugin) => plugin.id === block.pluginId && plugin.active,
            ),
      ),
    select: (id) => {
      this.themeState.selected.set(id);
      this.editorShell.setPanel("inspector");
      this.toolbarHidden = false;
      this.syncCanvasSelection();
      this.scheduleToolbarPosition();
    },
    focus: () => {
      this.canvasSequence++;
      clearTimeout(this.canvasTimer);
    },
    edited: () => {
      clearTimeout(this.canvasTimer);
      void this.refreshCanvas();
    },
  });
  private htmlEditor = new HtmlCanvasEditor(this.themeState, {
    select: (id) => {
      this.themeState.selected.set(id);
      this.editorShell.setPanel("inspector");
      this.toolbarHidden = false;
      this.syncCanvasSelection();
      this.scheduleToolbarPosition();
    },
    focus: () => {
      this.canvasSequence++;
      clearTimeout(this.canvasTimer);
    },
    edited: () => {
      clearTimeout(this.canvasTimer);
      void this.refreshCanvas();
    },
  });
  @ViewChild("surface", { static: true }) surface!: ElementRef<HTMLElement>;
  @ViewChild("editorShell") editorShell!: EditorShellComponent;
  templateSearch = "";
  activeThemeDocument?: ThemeDocument;
  activeThemeRecord?: any;
  themeMetadataBusy = false;
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
  pointerDragging = false;
  @ViewChild("editorDialog") dialog!: EditorDialogComponent;
  timer?: ReturnType<typeof setInterval>;
  mode: "blocks" | "html" = "blocks";
  htmlSource = "";
  htmlBaseline = "";
  previousBodyOverflow = "";
  previousHtmlOverflow = "";
  libraryOpen = false;
  blockListOpen = false;
  viewMode: "canvas" | "outline" = "canvas";
  previewWidth = 0;
  previewHtml: SafeHtml = "";
  private canvasUpdates = new EditorCanvasUpdates();
  private previewSource = "";
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
            "core/paragraph",
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
          "aria-label": "Content parser",
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
    const html = this.editor?.getHTML() || "<p></p>";
    const content = Array.isArray(this.entry.details?.contentBlocks)
      ? structuredClone(this.entry.details.contentBlocks)
      : /^\s*(?:<p>\s*(?:<br\s*\/?>)?\s*<\/p>)*\s*$/.test(html)
        ? []
        : [
            {
              id: "blk_" + crypto.randomUUID(),
              type: "core/rich-text",
              settings: {
                html,
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
    this.themeState.onConfirmRemoval = (title, message, confirmLabel) =>
      this.dialog.confirm(title, message, confirmLabel, "Cancel", true);
    this.themeState.load(document);
    this.themeState.selected.set(
      content[0]?.id || this.themeState.initialSelection(),
    );
  }
  async loadActiveBlockDefinitions() {
    const id = this.api.state()?.activeTheme?.manifest.id;
    if (!id) return;
    try {
      const record = await this.api.request("/themes/" + id);
      this.activeThemeRecord = record;
      this.activeThemeDocument = structuredClone(
        record.draft || record.published,
      );
      const current = this.themeState.document();
      if (current)
        this.themeState.document.set({
          ...current,
          blocks: record.published?.blocks || [],
          parts: structuredClone(record.published?.parts || {}),
          manifest: {
            ...current.manifest,
            parts: record.published?.manifest.parts || {},
          },
        });
      this.themeState.onEditPart = (name) => {
        if (this.api.state()?.user?.role !== "admin") {
          this.error.set("An administrator can edit shared theme content.");
          return;
        }
        window.open(
          "/admin/themes/edit/" +
            encodeURIComponent(id) +
            "?part=" +
            encodeURIComponent(name),
          "_blank",
          "noopener",
        );
      };
    } catch {
      // Built-in blocks remain available if the active theme cannot be loaded.
    }
  }
  syncThemeBlocks() {
    this.htmlEditor.syncState();
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
            node.settings["html"] || node.settings["text"],
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
  sidebarChanged({ panel, open }: { panel: EditorPanel; open: boolean }) {
    this.libraryOpen = open && panel === "blocks";
    this.blockListOpen = open && (panel === "list" || panel === "outline");
    this.scheduleToolbarPosition();
  }
  toggleLibrary(open = !this.libraryOpen) {
    this.editorShell.setPanel("blocks", open);
  }
  toggleBlockList(open = !this.blockListOpen) {
    this.editorShell.setPanel(open ? "list" : this.editorShell.panel, open);
  }
  paneTransition(event: TransitionEvent) {
    this.scheduleToolbarPosition();
  }
  setViewMode(mode: "canvas" | "outline") {
    this.editorShell.setPanel(
      mode === "outline" ? "outline" : this.editorShell.panel,
      mode === "outline",
    );
  }
  async previewContent() {
    await this.refreshCanvas();
    if (this.previewError) return;
    const frame = this.canvasFrame?.nativeElement;
    const html = this.previewSource;
    if (!html) {
      this.error.set("Switch to Blocks to preview your content.");
      return;
    }
    const preview = window.open("", "_blank");
    if (!preview) {
      this.error.set("Allow popups to open a content preview.");
      return;
    }
    preview.opener = null;
    preview.document.open();
    preview.document.write(html);
    preview.document.close();
    hydrateModels(preview.document);
    hydrateSliders(preview.document, true);
    hydrateMenus(preview.document);
  }
  async saveThemeMetadata() {
    if (!this.activeThemeDocument || !this.activeThemeRecord) return;
    this.themeMetadataBusy = true;
    try {
      const result = await this.api.request(
        "/themes/" + this.activeThemeRecord.id + "/draft",
        "PUT",
        {
          revision: this.activeThemeRecord.revision,
          document: this.activeThemeDocument,
        },
      );
      this.activeThemeRecord.revision = result.revision;
      this.api.toast("Theme details saved as a draft.");
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.themeMetadataBusy = false;
    }
  }
  setPreviewWidth(width: number) {
    this.previewWidth = width;
    this.scheduleToolbarPosition();
  }
  scheduleToolbarPosition = () => {
    if (this.toolbarFrame) return;
    this.toolbarFrame = requestAnimationFrame(() => {
      this.toolbarFrame = 0;
      syncEditorCanvasAppearance(this.canvasFrame?.nativeElement);
      this.positionBlockToolbar();
    });
  };
  private canvasBlocks = new Map<string, HTMLElement>();
  toolbarMoveLayout = { horizontal: false, reversed: false };
  private positionBlockToolbar() {
    const node = this.themeState.node;
    if (this.mode !== "blocks" || !node || this.themeState.protected(node)) {
      this.toolbarVisible = false;
      this.cdr.markForCheck();
      return;
    }
    let rect: DOMRect | undefined;
    const selectedBlock = this.canvasBlocks.get(node.id);
    this.toolbarMoveLayout = selectedBlock
      ? toolbarMovement(selectedBlock)
      : { horizontal: false, reversed: false };
    let bounds: DOMRect | undefined;
    if (this.viewMode === "canvas") {
      const frame = this.canvasFrame?.nativeElement;
      const block = this.canvasBlocks.get(node.id);
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
            : ".content-theme-outline .outline-tree",
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
    this.canvasSequence++;
    clearTimeout(this.canvasTimer);
    this.canvasTimer = setTimeout(() => void this.refreshCanvas(), 300);
  }
  async refreshCanvas() {
    if (this.destroyed || !this.themeState.root) return;
    if (this.textEditor.editing || this.htmlEditor.editing) return;
    const sequence = ++this.canvasSequence;
    try {
      const rendered = await this.api.request("/admin/content/render", "POST", {
        content: this.entry,
        contentBlocks: this.themeState.root.children || [],
        mainSettings: this.themeState.root.settings,
        mainId: this.themeState.root.id,
      });
      if (
        this.destroyed ||
        sequence !== this.canvasSequence ||
        this.textEditor.editing ||
        this.htmlEditor.editing
      )
        return;
      this.previewError = "";
      this.automation.reportRenderError();
      const html =
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}html,body{min-height:100%}' +
        rendered.css +
        "</style></head><body " +
        themeBodyAttributes(rendered.body) +
        ">" +
        rendered.html +
        "</body></html>";
      this.previewSource = html;
      if (this.canvasUpdates.update(this.canvasFrame?.nativeElement, html)) {
        this.enhanceContentCanvas();
      } else {
        this.canvasUpdates.prepare(html);
        this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(html);
      }
      this.cdr.markForCheck();
    } catch (e) {
      if (sequence === this.canvasSequence) {
        this.previewError = (e as Error).message;
        this.automation.reportRenderError(this.previewError);
        this.cdr.markForCheck();
      }
    }
  }
  enhanceContentCanvas() {
    const doc = this.canvasFrame?.nativeElement.contentDocument;
    if (!doc?.querySelector("main.content-main")) return;
    this.canvasUpdates.capture(doc);
    installEditorBlockPlaceholders(
      doc,
      (id) => this.themeState.find(id),
      this.themeState.root!.id,
    );
    syncEditorCanvasAppearance(this.canvasFrame?.nativeElement);
    hydrateModels(doc);
    hydrateSliders(doc, true);
    hydrateMenus(doc);
    this.frameToolbarEvents?.abort();
    this.frameToolbarEvents = new AbortController();
    doc.addEventListener(
      "keydown",
      (event) => this.editorShell.listShortcut(event),
      {
        signal: this.frameToolbarEvents.signal,
      },
    );
    doc.addEventListener("scroll", this.scheduleToolbarPosition, {
      capture: true,
      signal: this.frameToolbarEvents.signal,
    });
    const style = doc.createElement("style");
    doc.getElementById("cl-content-canvas-styles")?.remove();
    style.id = "cl-content-canvas-styles";
    style.textContent =
      ".cl-content-editable{cursor:pointer}.cl-content-editable:hover{outline:1px dashed #51906b;outline-offset:2px}.cl-content-selected{outline:2px solid #2f6b4f!important;outline-offset:2px}.cl-content-drop-target{outline:3px dashed #2f6b4f!important;outline-offset:2px}.theme-root [data-block-id].cl-overlay-block{pointer-events:auto}";
    doc.head.append(style);
    this.canvasBlocks.clear();
    for (const element of Array.from(
      doc.querySelectorAll<HTMLElement>("[data-block-id]"),
    )) {
      const id = canvasBlockId(element);
      if (!this.themeState.find(id)) continue;
      element.classList.add("cl-content-editable");
      if (!this.canvasBlocks.has(id)) this.canvasBlocks.set(id, element);
    }
    this.syncCanvasSelection();
    this.scheduleToolbarPosition();
    doc.addEventListener("submit", (event) => event.preventDefault(), {
      signal: this.frameToolbarEvents.signal,
    });
    doc.addEventListener(
      "click",
      (event) => {
        // Theme links belong to the preview, never navigate its iframe away from the draft.
        if (
          !(event.target as Element)?.closest?.(
            "[data-inline-text-editor],[data-html-editor]",
          )
        )
          event.preventDefault();
        const clicked = event.target as Element;
        const target = clicked.closest<HTMLElement>(".cl-content-editable");
        const id = canvasBlockId(target);
        if (!id || !this.themeState.find(id)) {
          this.previewNotice = "";
          this.cdr.markForCheck();
          return;
        }
        this.previewNotice = "";
        this.canvasBlocks.set(id, target!);
        this.themeState.selected.set(id);
        this.editorShell.setPanel("inspector");
        this.toolbarHidden = false;
        this.syncCanvasSelection();
        this.scheduleToolbarPosition();
      },
      { signal: this.frameToolbarEvents.signal },
    );
    this.textEditor.attach(doc);
    this.htmlEditor.attach(doc);
  }
  syncCanvasSelection() {
    const doc = this.canvasFrame?.nativeElement.contentDocument;
    if (!doc) return;
    revealEditorMenu(
      doc,
      this.canvasBlocks.get(this.themeState.selected()) || null,
    );
    doc
      .querySelectorAll("[data-block-id]")
      .forEach((element) =>
        element.classList.toggle(
          "cl-content-selected",
          canvasBlockId(element) === this.themeState.selected(),
        ),
      );
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
          const block = canvasBlockId(element)
            ? this.themeState.find(canvasBlockId(element))
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
      this.pointerDragging = false;
      source
        .closest(".content-editor-fullscreen")
        ?.classList.remove("is-dragging");
      this.cdr.markForCheck();
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
          this.pointerDragging = true;
          source
            .closest(".content-editor-fullscreen")
            ?.classList.add("is-dragging");
          this.cdr.markForCheck();
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
  async formatBlockText(key: string) {
    const node = this.themeState.node;
    if (!node) return;
    if (node.type === "core/rich-text") return;
    const doc = this.canvasFrame?.nativeElement.contentDocument;
    const block = this.canvasBlocks.get(node.id);
    const selection = doc?.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const selected =
      this.viewMode === "canvas" &&
      range &&
      !range.collapsed &&
      block?.contains(range.commonAncestorContainer) &&
      ["core/heading", "core/paragraph", "core/rich-text"].includes(node.type);
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
      const href = await this.dialog.prompt(
        "Add link",
        "Link URL (HTTPS, mailto, or local path)",
      );
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
        : node.type === "core/paragraph"
          ? block!.querySelector("p")
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
      let richText = ["core/paragraph", "core/rich-text"].includes(
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
      if (["core/paragraph", "core/rich-text"].includes(node.type)) return node;
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
    if (
      this.themeState.node?.type === "core/paragraph" &&
      parsed.body.querySelector(
        "p,div,section,h1,h2,h3,h4,h5,h6,ul,ol,table,blockquote,figure",
      )
    ) {
      this.themeState.commit(() => {
        this.themeState.node!.type = "core/rich-text";
      });
    }
    if (
      ["core/rich-text", "core/paragraph"].includes(
        this.themeState.node?.type || "",
      )
    ) {
      // Keep the older structured field in sync without replacing the block's source.
      this.editor.commands.setContent(
        this.themeState.node?.type === "core/paragraph"
          ? "<p>" + this.htmlSource + "</p>"
          : this.htmlSource,
      );
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
    return contentTemplateScope(
      this.kind,
      this.entry.id,
      this.api.state()?.settings,
    );
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
    const { id, updatedAt, status, publishAt } = this.entry;
    this.entry = {
      ...structuredClone(snapshot),
      id,
      updatedAt,
      status,
      publishAt,
    };
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
    return this.dialog.confirm(
      "Leave unsaved changes?",
      "Your changes since the last save will be discarded.",
      "Discard changes",
      "Keep editing",
    );
  }
  close() {
    this.router.navigate(["/" + (this.kind === "page" ? "pages" : "posts")]);
  }
  @HostListener("document:keydown", ["$event"]) key(event: KeyboardEvent) {
    if (event.defaultPrevented || this.dialog?.open || this.media.options())
      return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      this.save(this.entry.status);
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
      if (key === "k") {
        event.preventDefault();
        this.editorShell.openTemplates();
        return;
      }
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
    if (event.key === "Escape") {
      if (this.libraryOpen) this.toggleLibrary(false);
      else if (this.blockListOpen) this.toggleBlockList(false);
      else this.editorShell.setPanel("inspector", false);
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
    this.textEditor.destroy();
    this.htmlEditor.destroy();
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
