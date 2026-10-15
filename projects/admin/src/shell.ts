import { ScreenOptionsComponent } from "./screen-options.component";
import { MediaPickerComponent } from "../../../shared/media-picker.component";
import { AdminAppearanceService } from "../../../shared/admin-appearance.service";
import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from "@angular/core";
import { WORKSPACE_STEPS } from "../../../shared/workspace-progress";
import {
  Router,
  RouterLink,
  RouterOutlet,
  NavigationEnd,
} from "@angular/router";
import { ApiService } from "../../../shared/api.service";
import { IconComponent } from "../../../shared/icon.component";
import { PluginViewState } from "./plugin-view-state";
import { MaintenanceState } from "./maintenance-state";
import { PluginNavigationBadges } from "../../../shared/plugin-navigation-badges.service";
import { NgTemplateOutlet } from "@angular/common";
import { Plugin, AdminSubmenuLink } from "../../../shared/models";
import { AdminToolbar } from "../../../shared/admin-toolbar";
@Component({
  selector: "cl-admin",
  standalone: true,
  imports: [
    MediaPickerComponent,
    ScreenOptionsComponent,
    RouterLink,
    RouterOutlet,
    IconComponent,
    NgTemplateOutlet,
  ],
  styles: `
    .maintenance-switch {
      display: flex;
      align-items: center;
      gap: 8px;
      border: 0;
      background: transparent;
      padding: 6px;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .maintenance-switch:disabled {
      opacity: 0.6;
      cursor: wait;
    }
    .maintenance-switch:focus-visible {
      outline: 2px solid #22634e;
      outline-offset: 3px;
      border-radius: 6px;
    }
    .maintenance-switch-track {
      display: flex;
      align-items: center;
      width: 44px;
      height: 26px;
      padding: 3px;
      border-radius: 99px;
      background: #b63838;
      transition: background 0.15s;
    }
    .maintenance-switch-track::after {
      content: "";
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: white;
      box-shadow: 0 1px 3px #0003;
      transition: transform 0.15s;
    }
    .maintenance-switch.on .maintenance-switch-track {
      background: #23764f;
    }
    .maintenance-switch.on .maintenance-switch-track::after {
      transform: translateX(18px);
    }
  `,
  template: `
    @if (api.state()) {
      <div class="app-shell" [class.nav-expanded]="navigationExpanded">
        <ng-template #navigationItem let-p>
          <div
            class="admin-nav-item"
            [class.open]="submenuExpanded(p)"
            (keydown.escape)="closeSubmenu(p, $event)"
          >
            <a
              [routerLink]="
                p.admin.menu.children?.length ? null : route(p.admin.menu.path)
              "
              [class.active]="navigationActive(p)"
              [class.admin-nav-parent]="!!p.admin.menu.children?.length"
              [attr.role]="p.admin.menu.children?.length ? 'button' : null"
              [attr.tabindex]="p.admin.menu.children?.length ? 0 : null"
              [attr.aria-expanded]="
                p.admin.menu.children?.length ? submenuExpanded(p) : null
              "
              [attr.aria-controls]="
                p.admin.menu.children?.length ? 'submenu-' + p.id : null
              "
              [attr.aria-label]="p.admin.menu.label"
              [attr.aria-current]="
                !p.admin.menu.children?.length && navigationActive(p)
                  ? 'page'
                  : null
              "
              [attr.title]="p.admin.menu.label"
              (click)="activateNavigation(p, $event)"
              (keydown.enter)="activateParentKey(p, $event)"
              (keydown.space)="activateParentKey(p, $event)"
              (keydown.arrowright)="openSubmenu(p, $event)"
              (keydown.arrowleft)="closeSubmenu(p, $event)"
              ><cl-icon [name]="p.icon" /><span>{{ p.admin.menu.label }}</span>
              @if (navigationCount(p); as count) {
                <span
                  class="nav-count"
                  [attr.aria-label]="count + ' ' + navigationBadges.label(p.id)"
                  >{{ count }}</span
                >
              }
              @if (p.admin.menu.children?.length) {
                <cl-icon name="chevron" class="admin-submenu-caret" />
              }
            </a>
            @if (p.admin.menu.children?.length) {
              <ul
                class="admin-submenu"
                [id]="'submenu-' + p.id"
                [hidden]="!submenuExpanded(p)"
                [attr.aria-label]="p.admin.menu.label + ' submenu'"
              >
                @for (
                  child of p.admin.menu.children;
                  track child.id;
                  let index = $index
                ) {
                  <li>
                    <a
                      [routerLink]="route(child.path)"
                      [queryParams]="child.queryParams || {}"
                      [class.active]="submenuActive(child, index)"
                      [attr.aria-current]="
                        submenuActive(child, index) ? 'page' : null
                      "
                      (click)="menuOpen = false"
                      >{{ child.label }}</a
                    >
                  </li>
                }
              </ul>
            }
          </div>
        </ng-template>
        <aside class="sidebar" [class.mobile-open]="menuOpen">
          <div class="admin-navigation-panel">
            <a
              class="brand"
              routerLink="/dashboard"
              aria-label="Colossal CMS dashboard"
              title="Colossal CMS"
              ><span class="brand-mark">C</span
              ><span>colossal<span class="brand-cms">CMS</span></span></a
            >
            <a
              class="workspace"
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View your website (opens in a new tab)"
            >
              <span class="workspace-avatar">{{
                api.state()!.settings.title.charAt(0)
              }}</span>
              <div>
                <strong>{{ api.state()!.settings.title }}</strong
                ><small>Your workspace</small>
              </div>
              <cl-icon name="chevron" />
            </a>
            <span class="nav-label">WORKSPACE</span>
            <nav class="navigation-tree" aria-label="Main navigation">
              @for (p of mainNavigation; track p.id) {
                <ng-container
                  [ngTemplateOutlet]="navigationItem"
                  [ngTemplateOutletContext]="{ $implicit: p }"
                />
              }
            </nav>
            @if (systemNavigation.length) {
              <span class="nav-label extension-label">SYSTEM</span>
              <nav class="navigation-tree" aria-label="System navigation">
                @for (p of systemNavigation; track p.id) {
                  <ng-container
                    [ngTemplateOutlet]="navigationItem"
                    [ngTemplateOutletContext]="{ $implicit: p }"
                  />
                }
              </nav>
            }
            <div class="sidebar-bottom">
              <div class="workspace-note">
                <span class="tiny-label">MADE TO MAKE IT YOURS</span>
                <p>A little structure.<br />Room for big ideas.</p>
                <a routerLink="/plugins"
                  >Explore plugins <cl-icon name="arrow"
                /></a>
              </div>
              <a
                class="help-link"
                href="/docs/guide.html"
                target="_blank"
                aria-label="Workspace guide"
                title="Workspace guide"
                ><cl-icon name="book" /><span>Workspace guide</span>
                <cl-icon name="external"
              /></a>
              <div class="profile">
                <span class="avatar">{{ initials }}</span>
                <div>
                  <strong>{{ displayName }}</strong
                  ><small>{{
                    isLocal
                      ? "Local developer"
                      : api.state()!.user.role === "admin"
                        ? "Administrator"
                        : "Editor"
                  }}</small>
                </div>
                @if (passwordAuth) {
                  <button
                    type="button"
                    class="icon-button"
                    aria-label="Sign out"
                    (click)="signOut()"
                  >
                    <cl-icon name="logout" />
                  </button>
                } @else if (!isLocal) {
                  <a href="/signout-with-chatgpt?return_to=/" title="Sign out"
                    ><cl-icon name="logout"
                  /></a>
                }
              </div>
            </div>
          </div>
        </aside>
        @if (menuOpen) {
          <button
            class="sidebar-scrim"
            aria-label="Close navigation"
            (click)="menuOpen = false"
          ></button>
        }
        <div class="main-shell">
          <header class="topbar">
            <div class="breadcrumbs">
              <button
                type="button"
                class="navigation-toggle"
                [attr.aria-label]="
                  navigationExpanded
                    ? 'Collapse navigation'
                    : 'Expand navigation'
                "
                [attr.aria-expanded]="navigationExpanded"
                (click)="toggleNavigation()"
              >
                <cl-icon name="menu" />
              </button>
              <button
                class="icon-button mobile-menu"
                aria-label="Open navigation"
                (click)="menuOpen = !menuOpen"
              >
                <cl-icon name="menu" /></button
              ><span>Workspace</span><cl-icon name="chevron" /><strong>{{
                section
              }}</strong>
            </div>
            <div class="topbar-actions">
              @if (section === "Plugins") {
                <button
                  type="button"
                  class="icon-button core-visibility-toggle"
                  role="switch"
                  aria-label="Show core plugins"
                  [attr.aria-checked]="pluginView.showCore()"
                  [attr.title]="
                    pluginView.showCore()
                      ? 'Hide core plugins'
                      : 'Show core plugins'
                  "
                  [class.selected]="pluginView.showCore()"
                  (click)="pluginView.showCore.set(!pluginView.showCore())"
                >
                  <cl-icon [name]="pluginView.showCore() ? 'eye' : 'eye-off'" />
                </button>
              }
              @if (
                section === "Maintenance" && api.state()!.user.role === "admin"
              ) {
                <button
                  type="button"
                  class="maintenance-switch"
                  role="switch"
                  aria-label="Enable maintenance mode"
                  [attr.aria-checked]="
                    maintenance.data()?.settings.enabled || false
                  "
                  [class.on]="maintenance.data()?.settings.enabled"
                  [disabled]="!maintenance.data() || maintenance.busy()"
                  (click)="maintenance.toggle()"
                >
                  <span
                    >Maintenance
                    {{
                      maintenance.data()?.settings.enabled ? "On" : "Off"
                    }}</span
                  >
                  <span
                    class="maintenance-switch-track"
                    aria-hidden="true"
                  ></span>
                </button>
              }
              @if (contentScreenKind; as kind) {
                <cl-screen-options [kind]="kind" [seoEnabled]="seoEnabled" />
              }
              <ng-container [ngTemplateOutlet]="adminToolbar.content()" />
              <a class="button subtle" href="/" target="_blank"
                >View site <cl-icon name="external"
              /></a>
            </div>
          </header>
          <main><router-outlet /></main>
          <footer class="app-footer">
            <span
              >Colossal CMS <span class="muted">/</span> Built for what’s
              next.</span
            ><span>v0.0.3</span>
          </footer>
        </div>
      </div>
    } @else if (!setup && !error && showWorkspaceProgress()) {
      <div class="auth-page">
        <section
          class="auth-card workspace-progress-card"
          aria-busy="true"
          aria-labelledby="workspace-progress-title"
        >
          <span class="brand-mark">C</span>
          <p class="eyebrow">COLOSSAL CMS</p>
          <h1 id="workspace-progress-title">Preparing your workspace</h1>
          <p>
            We’re checking your database and preparing your themes, plugins, and
            content.
          </p>
          <p
            class="workspace-progress-message"
            role="status"
            aria-live="polite"
          >
            {{ api.workspaceProgress().message }}
          </p>
          <div
            class="workspace-progress-track"
            role="progressbar"
            aria-label="Database and workspace progress"
            aria-valuemin="0"
            aria-valuemax="100"
            [attr.aria-valuenow]="
              api.workspaceProgress().phase === 'connecting'
                ? null
                : progressPercent
            "
            [attr.aria-valuetext]="api.workspaceProgress().message"
          >
            <span
              [class.indeterminate]="
                api.workspaceProgress().phase === 'connecting'
              "
              [style.width.%]="progressPercent"
            ></span>
          </div>
          <ol class="workspace-progress-steps">
            @for (step of workspaceSteps; track step.label; let i = $index) {
              <li
                [class.complete]="i < api.workspaceProgress().completed"
                [class.current]="
                  api.workspaceProgress().phase !== 'connecting' &&
                  i === api.workspaceProgress().completed
                "
                [attr.aria-current]="
                  api.workspaceProgress().phase !== 'connecting' &&
                  i === api.workspaceProgress().completed
                    ? 'step'
                    : null
                "
              >
                <span class="workspace-step-marker">
                  @if (i < api.workspaceProgress().completed) {
                    <cl-icon name="check" />
                  } @else {
                    {{ i + 1 }}
                  }</span
                >{{ step.label }}
              </li>
            }
          </ol>
          <p class="workspace-progress-note">
            Your dashboard will open when these checks finish.
          </p>
        </section>
      </div>
    } @else if (setup || error) {
      <div class="auth-page">
        <div class="auth-card">
          <span class="brand-mark">C</span>
          <p class="eyebrow">COLOSSAL CMS</p>
          <h1>
            {{
              setup
                ? "A home for your next big idea."
                : error
                  ? "Let’s get you connected."
                  : "Opening your workspace…"
            }}
          </h1>
          <p>
            {{
              setup
                ? "Create your workspace to start writing, publishing, and making this site your own. Three sample entries will help you get started."
                : error || "Loading your content and settings."
            }}
          </p>
          @if (setup) {
            <button class="button primary" [disabled]="busy" (click)="create()">
              {{ busy ? "Creating workspace…" : "Create my workspace" }}
              <cl-icon name="arrow" />
            </button>
          } @else if (error) {
            <button class="button primary" (click)="initialize()">
              Try again
            </button>
            <a
              class="button"
              [href]="
                api.workspacePasswordAuth() === true || passwordAuth
                  ? '/login'
                  : '/signin-with-chatgpt?return_to=/admin/'
              "
              target="_top"
              >Sign in</a
            >
          }
        </div>
      </div>
    }
    <cl-media-picker />
    @if (api.notice()) {
      <div class="toast" role="status">
        <cl-icon name="check" />{{ api.notice() }}
      </div>
    }
  `,
})
export class AdminComponent implements OnInit, OnDestroy {
  cdr = inject(ChangeDetectorRef);
  workspaceSteps = WORKSPACE_STEPS;
  maintenance = inject(MaintenanceState);
  pluginView = inject(PluginViewState);
  api = inject(ApiService);
  navigationBadges = inject(PluginNavigationBadges);
  adminToolbar = inject(AdminToolbar);
  appearance = inject(AdminAppearanceService);
  router = inject(Router);
  setup = false;
  passwordAuth = false;
  busy = false;
  error = "";
  navigationExpanded = window.matchMedia("(min-width: 761px)").matches;
  toggleNavigation() {
    this.navigationExpanded = !this.navigationExpanded;
  }
  menuOpen = false;
  section = "Dashboard";
  showWorkspaceProgress = signal(false);
  private workspaceProgressTimer?: ReturnType<typeof setTimeout>;
  expandedNavigation: string | null | undefined;
  navigationActive(plugin: Plugin) {
    return this.router.isActive(
      this.router.createUrlTree([this.route(plugin.admin.menu.path)]),
      {
        paths: "subset",
        queryParams: "ignored",
        fragment: "ignored",
        matrixParams: "ignored",
      },
    );
  }
  submenuExpanded(plugin: Plugin) {
    return (
      this.navigationExpanded &&
      !!plugin.admin.menu.children?.length &&
      (this.expandedNavigation === undefined
        ? this.navigationActive(plugin)
        : this.expandedNavigation === plugin.id)
    );
  }
  submenuActive(child: AdminSubmenuLink, index: number) {
    const pathMatches = this.router.isActive(
      this.router.createUrlTree([this.route(child.path)]),
      {
        paths: "exact",
        queryParams: "ignored",
        fragment: "ignored",
        matrixParams: "ignored",
      },
    );
    const params = this.router.parseUrl(this.router.url).queryParamMap;
    return (
      pathMatches &&
      Object.entries(child.queryParams || {}).every(
        ([key, value]) =>
          params.get(key) === value || (!params.has(key) && index === 0),
      )
    );
  }
  navigationCount(plugin: Plugin) {
    return plugin.id === "com.colossal.posts"
      ? this.postCount
      : plugin.id === "com.colossal.pages"
        ? this.pageCount
        : this.navigationBadges.count(plugin.id);
  }
  activateNavigation(plugin: Plugin, event: Event) {
    if (!plugin.admin.menu.children?.length) {
      this.menuOpen = false;
      return;
    }
    event.preventDefault();
    const opening = !this.submenuExpanded(plugin);
    this.expandedNavigation = opening ? plugin.id : null;
    this.navigationExpanded = true;
    if (opening) {
      const first = plugin.admin.menu.children[0];
      void this.router.navigate([this.route(first.path)], {
        queryParams: first.queryParams || {},
      });
    }
  }
  activateParentKey(plugin: Plugin, event: Event) {
    if (plugin.admin.menu.children?.length)
      this.activateNavigation(plugin, event);
  }
  openSubmenu(plugin: Plugin, event: Event) {
    if (!plugin.admin.menu.children?.length) return;
    event.preventDefault();
    this.expandedNavigation = plugin.id;
    this.navigationExpanded = true;
    const group = (event.currentTarget as HTMLElement).closest(
      ".admin-nav-item",
    );
    this.cdr.detectChanges();
    group?.querySelector<HTMLElement>(".admin-submenu a")?.focus();
  }
  closeSubmenu(plugin: Plugin, event: Event) {
    if (!plugin.admin.menu.children?.length) return;
    event.preventDefault();
    this.expandedNavigation = null;
    (event.target as HTMLElement)
      .closest(".admin-nav-item")
      ?.querySelector<HTMLElement>(".admin-nav-parent")
      ?.focus();
  }
  ngOnDestroy() {
    clearTimeout(this.workspaceProgressTimer);
  }
  ngOnInit() {
    this.initialize();
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.expandedNavigation =
          this.api
            .state()
            ?.plugins.find(
              (p) => p.admin.menu.children?.length && this.navigationActive(p),
            )?.id || null;
        const part = e.urlAfterRedirects.split("?")[0].split("/")[1];
        this.section = part
          ? part
              .split("-")
              .map((x) => x[0].toUpperCase() + x.slice(1))
              .join(" ")
          : "Dashboard";
      }
    });
  }
  async initialize() {
    this.error = "";
    this.showWorkspaceProgress.set(false);
    clearTimeout(this.workspaceProgressTimer);
    this.workspaceProgressTimer = setTimeout(() => {
      this.showWorkspaceProgress.set(true);
    }, 400);
    try {
      const session = await this.api.openWorkspace();
      this.passwordAuth = session.passwordAuth === true;
      this.setup = !!session.setup;
      if (!this.setup) {
        const path = location.pathname.replace(/^\/admin/, "");
        this.router.navigateByUrl(
          (!path || path === "/" ? "/dashboard" : path) +
            location.search +
            location.hash,
        );
      }
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      clearTimeout(this.workspaceProgressTimer);
      this.showWorkspaceProgress.set(false);
      this.cdr.markForCheck();
    }
  }
  get progressPercent() {
    const progress = this.api.workspaceProgress();
    return Math.round((progress.completed / progress.total) * 100);
  }
  async create() {
    this.busy = true;
    try {
      await this.api.request("/admin/setup", "POST", {});
      this.setup = false;
      await this.initialize();
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
    }
  }
  route(path: string) {
    return path.replace("/admin", "");
  }
  async signOut() {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (response.ok) window.location.assign("/login");
    else this.api.toast("Sign out failed. Please try again.");
  }
  navigation(group: "main" | "system") {
    return this.api
      .state()!
      .plugins.filter(
        (p) =>
          p.active &&
          (p.admin.menu.group || "main") === group &&
          (this.api.state()!.user.role === "admin" ||
            [
              "com.colossal.dashboard",
              "com.colossal.media",
              "com.colossal.posts",
              "com.colossal.pages",
            ].includes(p.id)),
      )
      .sort((a, b) => (a.admin.menu.order || 0) - (b.admin.menu.order || 0));
  }
  get contentScreenKind(): "page" | "post" | null {
    const path = this.router.url.split(/[?#]/)[0];
    return path === "/pages" ? "page" : path === "/posts" ? "post" : null;
  }
  get seoEnabled() {
    return !!this.api
      .state()
      ?.plugins.some((p) => p.id === "com.colossal.seo" && p.active);
  }
  get mainNavigation() {
    return this.navigation("main");
  }
  get systemNavigation() {
    return this.navigation("system");
  }
  get postCount() {
    return this.api.state()!.content.filter((c) => c.kind === "post").length;
  }
  get pageCount() {
    return this.api.state()!.content.filter((c) => c.kind === "page").length;
  }
  get displayName() {
    return this.api.state()!.user.email.split("@")[0].replace(/[._]/g, " ");
  }
  get initials() {
    return this.displayName.slice(0, 2).toUpperCase();
  }
  get isLocal() {
    return this.api.state()!.user.email === "developer@localhost.test";
  }
}
