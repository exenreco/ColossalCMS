import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  HostListener,
  inject,
  effect,
  afterNextRender,
  Injector,
} from "@angular/core";
import { AdminExtensionSlotComponent } from "./admin-extension-slot.component";
import { EditorIconComponent } from "./editor-icon.component";
import { UiSurfaceComponent } from "./ui-surface.component";
import { EditorPreferencesService } from "./editor-preferences.service";
import { syncEditorCanvasAppearance } from "./editor-canvas-appearance";

export type EditorPanel = "inspector" | "blocks" | "list" | "outline";
@Component({
  selector: "cl-editor-shell",
  standalone: true,
  imports: [
    EditorIconComponent,
    UiSurfaceComponent,
    AdminExtensionSlotComponent,
  ],
  template: `
    <div
      class="shared-editor"
      [attr.data-color-mode]="preferences.colorMode()"
      [attr.data-walkthrough]="tourSteps[tour - 1]?.key"
      [class.sidebar-closed]="!sidebarOpen"
      [class.inspector-closed]="!inspectorOpen"
      (transitionend)="layoutChange.emit()"
    >
      <nav class="editor-rail" aria-label="Editor tools">
        <button
          class="editor-brand"
          aria-label="Back to workspace"
          title="Back to workspace"
          (click)="leave.emit()"
        >
          <span class="editor-brand-mark" aria-hidden="true"
            >C<span>·</span></span
          ><cl-editor-icon class="editor-brand-back" name="back" />
        </button>
        <div class="editor-rail-tools">
          <button
            class="blocks-trigger editor-tool"
            data-tour="blocks"
            aria-label="Blocks"
            title="Blocks (Ctrl+B)"
            [attr.aria-pressed]="sidebarOpen && panel === 'blocks'"
            (click)="togglePanel('blocks')"
          >
            <cl-editor-icon name="plus" />
          </button>
          <button
            class="block-list-trigger editor-tool"
            data-tour="list"
            aria-label="List view"
            title="List view (Ctrl/Cmd+Shift+L)"
            aria-keyshortcuts="Control+Shift+L Meta+Shift+L"
            [attr.aria-pressed]="sidebarOpen && panel === 'list'"
            (click)="togglePanel('list')"
          >
            <cl-editor-icon name="list" />
          </button>
          <button
            class="outline-trigger editor-tool"
            data-tour="outline"
            aria-label="Outline"
            title="Outline (Ctrl+Shift+O)"
            [attr.aria-pressed]="sidebarOpen && panel === 'outline'"
            (click)="togglePanel('outline')"
          >
            <cl-editor-icon name="outline" />
          </button>
          <cl-admin-extension-slot slot="editor-tools" />
        </div>
        <button
          class="editor-tool editor-tour-replay"
          aria-label="Replay editor walkthrough"
          title="Editor walkthrough"
          (click)="tour = 0; overlay = ''"
        >
          <cl-editor-icon name="help" />
        </button>
      </nav>
      <aside
        class="editor-sidebar"
        [attr.inert]="sidebarOpen ? null : ''"
        [attr.aria-hidden]="!sidebarOpen"
        aria-label="Editor sidebar"
      >
        <div class="editor-sidebar-heading">
          <button
            #panelTrigger
            class="editor-panel-selector"
            aria-haspopup="menu"
            [attr.aria-expanded]="overlay === 'panels'"
            (click)="toggleOverlay('panels')"
          >
            {{ panelLabels[panel] }}<cl-editor-icon name="chevron" />
          </button>
        </div>
        <div class="editor-sidebar-scroll">
          <div
            class="editor-panel-content"
            [hidden]="panel !== 'blocks'"
            [attr.inert]="panel === 'blocks' ? null : ''"
          >
            <ng-content select="[editor-blocks]" />
          </div>
          <div
            class="editor-panel-content"
            [hidden]="panel !== 'list' && panel !== 'outline'"
            [attr.inert]="panel === 'list' || panel === 'outline' ? null : ''"
          >
            <ng-content select="[editor-structure]" />
          </div>
        </div>
        <div class="editor-sidebar-footer" role="status">{{ status }}</div>
      </aside>
      @if (sidebarOpen) {
        <button
          class="editor-sidebar-scrim"
          aria-label="Close sidebar"
          (click)="toggleSidebar()"
        ></button>
      }
      <header class="shared-editor-header">
        <div class="editor-breadcrumb">
          <button
            class="editor-tool"
            aria-label="Toggle sidebar"
            [attr.aria-expanded]="sidebarOpen"
            (click)="toggleSidebar()"
          >
            <cl-editor-icon name="panel" />
          </button>
          <span>{{ kind }}</span
          ><span class="breadcrumb-divider">›</span><span>Editor</span
          ><span class="breadcrumb-divider">›</span
          ><strong [title]="title">{{ title }}</strong>
        </div>
        <button
          #templateTrigger
          class="editor-template-trigger"
          data-tour="templates"
          aria-haspopup="dialog"
          [attr.aria-expanded]="overlay === 'templates'"
          aria-label="Choose template"
          (click)="openTemplates()"
        >
          <span
            >Template <span class="editor-template-dot">•</span>
            {{ templateName }}</span
          ><kbd>Ctrl+K</kbd
          ><cl-editor-icon class="editor-small-chevron" name="chevron" />
        </button>
        <div class="editor-header-actions">
          <button
            class="editor-tool"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            [disabled]="!canUndo || busy"
            (click)="undo.emit()"
          >
            <cl-editor-icon name="undo" />
          </button>
          <button
            class="editor-tool"
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            [disabled]="!canRedo || busy"
            (click)="redo.emit()"
          >
            <cl-editor-icon name="redo" />
          </button>
          <span class="editor-toolbar-divider"></span>
          <button
            #viewportTrigger
            class="editor-tool editor-viewport-trigger"
            data-tour="viewport"
            aria-label="Viewport"
            title="Viewport"
            aria-haspopup="menu"
            [attr.aria-expanded]="overlay === 'viewport'"
            (click)="toggleOverlay('viewport')"
          >
            <cl-editor-icon
              [name]="
                width === 390
                  ? 'mobile'
                  : width === 768
                    ? 'tablet'
                    : width === 0
                      ? 'fit'
                      : 'desktop'
              "
            /><cl-editor-icon class="editor-small-chevron" name="chevron" />
          </button>
          <button
            class="editor-tool"
            aria-label="Template preview"
            title="Preview template"
            [disabled]="busy"
            (click)="preview.emit()"
          >
            <cl-editor-icon name="preview" />
          </button>
          <button
            #metadataTrigger
            class="editor-tool editor-menu-trigger"
            aria-label="Theme preview"
            title="Theme details"
            aria-haspopup="dialog"
            [attr.aria-expanded]="overlay === 'metadata'"
            (click)="toggleOverlay('metadata')"
          >
            <cl-editor-icon name="theme" /><cl-editor-icon
              class="editor-small-chevron"
              name="chevron"
            />
          </button>
          <button
            class="editor-save"
            data-tour="save"
            aria-label="Save draft"
            [disabled]="busy"
            (click)="save.emit()"
          >
            {{ busy ? "Saving…" : "Save" }}
          </button>
          <button
            class="editor-tool editor-inspector-trigger"
            data-tour="inspector"
            aria-label="Toggle Inspector"
            title="Inspector"
            aria-controls="editor-inspector-sidebar"
            [attr.aria-expanded]="inspectorOpen"
            [attr.aria-pressed]="inspectorOpen"
            (click)="toggleInspector()"
          >
            <cl-editor-icon name="inspector" />
          </button>
          <button
            #settingsTrigger
            class="editor-tool editor-menu-trigger"
            aria-label="Editor settings"
            title="Editor settings"
            aria-haspopup="dialog"
            [attr.aria-expanded]="overlay === 'settings'"
            (click)="toggleOverlay('settings')"
          >
            <cl-editor-icon name="settings" /><cl-editor-icon
              class="editor-small-chevron"
              name="chevron"
            />
          </button>
        </div>
      </header>
      <main
        class="shared-editor-canvas"
        aria-label="Editor canvas"
        (transitionend)="layoutChange.emit()"
      >
        <ng-content select="[editor-canvas]" />
      </main>
      <aside
        id="editor-inspector-sidebar"
        class="editor-inspector-sidebar"
        aria-label="Inspector sidebar"
        [attr.inert]="inspectorOpen ? null : ''"
        [attr.aria-hidden]="!inspectorOpen"
      >
        <div class="editor-inspector-heading">
          <span><cl-editor-icon name="inspector" />Inspector</span>
          <button
            class="editor-tool"
            aria-label="Close Inspector"
            (click)="setInspector(false)"
          >
            <cl-editor-icon name="close" />
          </button>
        </div>
        <div class="editor-inspector-scroll">
          <div class="editor-panel-content">
            <ng-content select="[editor-inspector]" />
          </div>
        </div>
      </aside>
      @if (inspectorOpen) {
        <button
          class="editor-inspector-scrim"
          aria-label="Dismiss Inspector"
          (click)="setInspector(false)"
        ></button>
      }
      <ng-content select="[editor-dialogs]" />
      <cl-ui-surface
        kind="menu"
        label="Sidebar panels"
        [open]="overlay === 'panels'"
        [anchor]="panelTrigger"
        [width]="280"
        (dismissed)="closeOverlay()"
      >
        <p class="editor-menu-eyebrow">Workspace</p>
        @for (option of panels; track option.id) {
          <button
            role="menuitem"
            class="editor-menu-row"
            (click)="setPanel(option.id); closeOverlay()"
          >
            <cl-editor-icon [name]="option.icon" /><span>{{
              option.label
            }}</span>
            @if (option.shortcut) {
              <kbd>{{ option.shortcut }}</kbd>
            }
            @if (panel === option.id) {
              <cl-editor-icon name="check" />
            }
          </button>
        }
      </cl-ui-surface>
      <cl-ui-surface
        kind="menu"
        label="Viewport options"
        [arrow]="true"
        [open]="overlay === 'viewport'"
        [anchor]="viewportTrigger"
        [width]="310"
        (dismissed)="closeOverlay()"
      >
        <div class="editor-surface-heading">
          <strong>Viewport</strong
          ><span class="editor-menu-note">Preview your layout</span>
        </div>
        @for (size of sizes; track size.width) {
          <button
            role="menuitem"
            class="editor-menu-row"
            (click)="widthChange.emit(size.width); closeOverlay()"
          >
            <cl-editor-icon [name]="size.icon" /><span
              >{{ size.name
              }}<small>{{
                size.width ? size.width + " px" : "Fill available canvas"
              }}</small></span
            >
            @if (width === size.width) {
              <cl-editor-icon name="check" />
            }
          </button>
        }
      </cl-ui-surface>
      <cl-ui-surface
        kind="popover"
        label="Theme details"
        [arrow]="true"
        [open]="overlay === 'metadata'"
        [anchor]="metadataTrigger"
        [width]="360"
        (dismissed)="closeOverlay()"
        ><div class="editor-surface-heading">
          <strong>Theme preview</strong
          ><button
            class="editor-tool"
            aria-label="Close theme details"
            (click)="closeOverlay()"
          >
            <cl-editor-icon name="close" />
          </button>
        </div>
        <ng-content select="[editor-metadata]"
      /></cl-ui-surface>
      <cl-ui-surface
        kind="popover"
        label="Editor settings"
        [arrow]="true"
        [open]="overlay === 'settings'"
        [anchor]="settingsTrigger"
        [width]="330"
        (dismissed)="closeOverlay()"
        ><div class="editor-surface-heading">
          <strong>Editor settings</strong
          ><button
            class="editor-tool"
            aria-label="Close editor settings"
            (click)="closeOverlay()"
          >
            <cl-editor-icon name="close" />
          </button>
        </div>
        <ng-content select="[editor-settings]" /><button
          class="editor-menu-row"
          (click)="closeOverlay(); tour = 0"
        >
          <cl-editor-icon name="help" /><span>Replay walkthrough</span>
        </button></cl-ui-surface
      >
      <cl-ui-surface
        kind="modal"
        label="Choose template"
        [open]="overlay === 'templates'"
        [anchor]="templateTrigger"
        [width]="600"
        (dismissed)="closeOverlay()"
        ><div class="editor-surface-heading">
          <div>
            <p class="editor-menu-eyebrow">Your workspace</p>
            <h2>Choose a template</h2>
          </div>
          <button
            class="editor-tool"
            aria-label="Close templates"
            (click)="closeOverlay()"
          >
            <cl-editor-icon name="close" />
          </button>
        </div>
        <ng-content select="[editor-templates]"
      /></cl-ui-surface>
      <cl-ui-surface
        kind="modal"
        label="Welcome to the editor"
        [open]="tour === 0"
        [width]="490"
        (dismissed)="finishTour()"
        ><div class="editor-tour-welcome">
          <span class="editor-tour-symbol"
            ><cl-editor-icon name="panel"
          /></span>
          <p class="editor-menu-eyebrow">A little room to create</p>
          <h2>Meet your new editor.</h2>
          <p>
            One sidebar for your blocks, outline, and settings. More space for
            everything you create.
          </p>
          <div class="editor-tour-actions">
            <button class="editor-quiet-button" (click)="finishTour()">
              Skip walkthrough</button
            ><button class="editor-save" (click)="nextTour()">
              Show me around
            </button>
          </div>
        </div></cl-ui-surface
      >
      <cl-ui-surface
        kind="popover"
        label="Editor walkthrough"
        panelClass="editor-tour-popover"
        [open]="tour > 0"
        [anchor]="tourAnchor"
        placement="side"
        [width]="340"
        [restoreFocus]="false"
        (dismissed)="finishTour()"
        ><div class="editor-surface-heading">
          <span class="editor-menu-eyebrow"
            >{{ tour }} of {{ tourSteps.length }}</span
          ><button
            class="editor-tool"
            aria-label="Skip walkthrough"
            (click)="finishTour()"
          >
            <cl-editor-icon name="close" />
          </button>
        </div>
        <h3>{{ tourSteps[tour - 1]?.title }}</h3>
        <p>{{ tourSteps[tour - 1]?.text }}</p>
        <div class="editor-tour-progress">
          @for (step of tourSteps; track step.key; let i = $index) {
            <span [class.current]="i < tour"></span>
          }
        </div>
        <div class="editor-tour-actions">
          <button class="editor-quiet-button" (click)="finishTour()">
            Skip</button
          ><button class="editor-save" (click)="nextTour()">
            {{ tour === tourSteps.length ? "Finish" : "Next" }}
          </button>
        </div></cl-ui-surface
      >
    </div>
  `,
})
export class EditorShellComponent implements OnInit {
  preferences = inject(EditorPreferencesService);
  private host = inject(ElementRef) as ElementRef<HTMLElement>;
  private cdr = inject(ChangeDetectorRef);
  @Input() kind = "Theme";
  @Input() title = "Untitled";
  @Input() templateName = "Home";
  @Input() status = "Draft";
  @Input() width = 0;
  @Input() canUndo = false;
  @Input() canRedo = false;
  @Input() busy = false;
  @Output() leave = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() preview = new EventEmitter<void>();
  @Output() undo = new EventEmitter<void>();
  @Output() redo = new EventEmitter<void>();
  @Output() widthChange = new EventEmitter<number>();
  @Output() panelChange = new EventEmitter<{
    panel: EditorPanel;
    open: boolean;
  }>();
  @Output() layoutChange = new EventEmitter<void>();
  @Output() inspectorChange = new EventEmitter<boolean>();
  panel: EditorPanel = "list";
  inspectorOpen = false;
  sidebarOpen = !window.matchMedia("(max-width: 700px)").matches;
  private panelScroll = new Map<EditorPanel, number>();
  overlay = "";
  tour = -1;
  panelLabels = {
    inspector: "Inspector",
    blocks: "Blocks",
    list: "List view",
    outline: "Outline",
  };
  panels: {
    id: EditorPanel;
    label: string;
    icon: string;
    shortcut?: string;
  }[] = [
    { id: "blocks", label: "Blocks", icon: "plus", shortcut: "Ctrl B" },
    { id: "list", label: "List view", icon: "list", shortcut: "Ctrl ⇧ L" },
    { id: "outline", label: "Outline", icon: "outline", shortcut: "Ctrl ⇧ O" },
  ];
  sizes = [
    { name: "Fit canvas", width: 0, icon: "fit" },
    { name: "Desktop", width: 1200, icon: "desktop" },
    { name: "Tablet", width: 768, icon: "tablet" },
    { name: "Mobile", width: 390, icon: "mobile" },
  ];
  tourSteps = [
    {
      key: "blocks",
      title: "Start with a block",
      text: "Find a block here. Click to add it, or drag it onto your canvas.",
    },
    {
      key: "list",
      title: "Your blocks at a glance",
      text: "List view opens by default. Use Ctrl/Cmd+Shift+L to open it. Select a block, drag to reorder, or right-click for copy, cut, paste, and more.",
    },
    {
      key: "outline",
      title: "See the whole picture",
      text: "Rearrange blocks in Outline. Expand groups or right-click a block for more actions. Your canvas stays in view.",
    },
    {
      key: "inspector",
      title: "Make it yours",
      text: "Select a block to edit its content, layout, colors, and more in the right Inspector. This button opens or closes it independently of your block list.",
    },
    {
      key: "templates",
      title: "Move between templates",
      text: "Use this button, or Ctrl+K, to open the template picker. Shared parts are here too.",
    },
    {
      key: "viewport",
      title: "Check every screen",
      text: "Preview desktop, tablet, or mobile sizes. Fit canvas uses all the space available.",
    },
    {
      key: "save",
      title: "Save when you’re ready",
      text: "Save keeps a draft. Publishing is in Editor settings. You can undo changes or preview your work from this toolbar.",
    },
  ];
  get tourAnchor() {
    return (
      this.host.nativeElement.querySelector<HTMLElement>(
        `[data-tour="${this.tourSteps[this.tour - 1]?.key}"]`,
      ) || undefined
    );
  }
  async ngOnInit() {
    this.panelChange.emit({ panel: this.panel, open: this.sidebarOpen });
    await this.preferences.load();
    if (this.preferences.walkthroughVersion() < 1) this.tour = 0;
    this.cdr.markForCheck();
  }
  private injector = inject(Injector);
  constructor() {
    effect(() => {
      this.preferences.colorMode();
      afterNextRender(
        () => {
          this.host.nativeElement
            .querySelectorAll<HTMLIFrameElement>(
              ".theme-live-preview,.content-live-preview",
            )
            .forEach(syncEditorCanvasAppearance);
        },
        { injector: this.injector },
      );
    });
  }
  setPanel(panel: EditorPanel, open = true) {
    // Preserve the host editors' settings commands without replacing the left panel.
    if (panel === "inspector") {
      this.setInspector(open);
      return;
    }
    if (open && window.matchMedia("(max-width: 700px)").matches)
      this.setInspector(false);
    const scroll = this.host.nativeElement.querySelector<HTMLElement>(
      ".editor-sidebar-scroll",
    );
    if (scroll) this.panelScroll.set(this.panel, scroll.scrollTop);
    this.panel = panel;
    this.sidebarOpen = open;
    this.panelChange.emit({ panel, open });
    this.layoutChange.emit();
    requestAnimationFrame(() => {
      if (!this.host.nativeElement.isConnected) return;
      if (scroll) scroll.scrollTop = this.panelScroll.get(panel) || 0;
      if (open && panel === "blocks" && this.tour < 0 && !this.overlay)
        this.host.nativeElement
          .querySelector<HTMLElement>(".block-library__search")
          ?.focus({ preventScroll: true });
    });
  }
  togglePanel(panel: EditorPanel) {
    if (panel === "inspector") {
      this.toggleInspector();
      return;
    }
    this.setPanel(panel, !(this.sidebarOpen && this.panel === panel));
  }
  setInspector(open: boolean) {
    if (this.inspectorOpen === open) return;
    if (
      open &&
      window.matchMedia("(max-width: 700px)").matches &&
      this.sidebarOpen
    )
      this.setPanel(this.panel, false);
    this.inspectorOpen = open;
    this.inspectorChange.emit(open);
    this.layoutChange.emit();
    if (
      !open &&
      this.host.nativeElement
        .querySelector(".editor-inspector-sidebar")
        ?.contains(document.activeElement)
    )
      this.host.nativeElement
        .querySelector<HTMLElement>(".editor-inspector-trigger")
        ?.focus({ preventScroll: true });
  }
  toggleInspector() {
    this.setInspector(!this.inspectorOpen);
  }
  toggleSidebar() {
    this.setPanel(this.panel, !this.sidebarOpen);
  }
  toggleOverlay(overlay: string) {
    this.overlay = this.overlay === overlay ? "" : overlay;
  }
  openTemplates() {
    this.overlay = "templates";
  }
  closeOverlay() {
    this.overlay = "";
  }
  @HostListener("document:keydown", ["$event"])
  shortcut(event: KeyboardEvent) {
    if (
      event.key === "Escape" &&
      !event.defaultPrevented &&
      (event.target as HTMLElement)?.closest(".editor-inspector-sidebar") &&
      !(event.target as HTMLElement)?.closest(".cl-ui-surface")
    ) {
      event.preventDefault();
      this.setInspector(false);
      this.cdr.markForCheck();
      return;
    }
    if (this.listShortcut(event)) return;
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "k" &&
      !event.defaultPrevented
    ) {
      event.preventDefault();
      this.openTemplates();
    }
  }
  nextTour() {
    if (this.tour >= this.tourSteps.length) return this.finishTour();
    this.tour++;
    const key = this.tourSteps[this.tour - 1]?.key;
    if (key && ["blocks", "list", "outline", "inspector"].includes(key))
      this.setPanel(key as EditorPanel);
  }
  listShortcut(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      !(event.ctrlKey || event.metaKey) ||
      !event.shiftKey ||
      event.altKey ||
      event.key.toLowerCase() !== "l" ||
      (event.target as HTMLElement)?.closest(
        "input,textarea,select,[contenteditable]",
      ) ||
      this.host.nativeElement.querySelector(
        ".cl-ui-modal[open],.cl-ui-surface:popover-open",
      )
    )
      return false;
    event.preventDefault();
    this.setPanel("list");
    this.cdr.markForCheck();
    return true;
  }
  finishTour() {
    this.tour = -1;
    void this.preferences.update({ walkthroughVersion: 1 });
  }
}
