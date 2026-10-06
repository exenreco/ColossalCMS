import { MediaPickerComponent } from "../../../shared/media-picker.component";
import { DashboardSkeletonComponent } from "../../../shared/skeleton-compositions";
import { SkeletonComponent } from "../../../shared/skeleton.component";
import { Component, inject, signal, OnInit } from "@angular/core";
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  NavigationEnd,
} from "@angular/router";
import { ApiService } from "../../../shared/api.service";
import { IconComponent } from "../../../shared/icon.component";
import { PluginViewState } from "./plugin-view-state";
import { MaintenanceState } from "./maintenance-state";
@Component({
  selector: "cl-admin",
  standalone: true,
  imports: [
    MediaPickerComponent,
    DashboardSkeletonComponent,
    SkeletonComponent,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    IconComponent,
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
      <div class="app-shell">
        <aside class="sidebar" [class.mobile-open]="menuOpen">
          <a class="brand" routerLink="/dashboard"
            ><span class="brand-mark">C</span
            ><span>colossal<span class="brand-cms">CMS</span></span></a
          >
          <div class="workspace">
            <span class="workspace-avatar">{{
              api.state()!.settings.title.charAt(0)
            }}</span>
            <div>
              <strong>{{ api.state()!.settings.title }}</strong
              ><small>Your workspace</small>
            </div>
            <cl-icon name="chevron" />
          </div>
          <span class="nav-label">WORKSPACE</span>
          <nav aria-label="Main navigation">
            @for (p of mainNavigation; track p.id) {
              <a
                [routerLink]="route(p.admin.menu.path)"
                routerLinkActive="active"
                (click)="menuOpen = false"
                ><cl-icon [name]="p.icon" /><span>{{
                  p.admin.menu.label
                }}</span>
                @if (p.id.endsWith("posts")) {
                  <span class="nav-count">{{ postCount }}</span>
                }
              </a>
            }
          </nav>
          @if (systemNavigation.length) {
            <span class="nav-label extension-label">SYSTEM</span>
            <nav aria-label="System navigation">
              @for (p of systemNavigation; track p.id) {
                <a
                  [routerLink]="route(p.admin.menu.path)"
                  routerLinkActive="active"
                  (click)="menuOpen = false"
                  ><cl-icon [name]="p.icon" /><span>{{
                    p.admin.menu.label
                  }}</span></a
                >
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
            <a class="help-link" href="/docs/guide.html" target="_blank"
              ><cl-icon name="book" /> Workspace guide <cl-icon name="external"
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
            ><span>v0.0.1</span>
          </footer>
        </div>
      </div>
    } @else if (!setup && !error) {
      <div
        class="app-shell app-shell-skeleton"
        role="status"
        aria-busy="true"
        aria-label="Opening your workspace"
      >
        <aside class="sidebar">
          <span class="brand"><span class="brand-mark">C</span></span>
          <cl-skeleton variant="rectangle" height="84px" radius="12px" />
          <cl-skeleton variant="paragraph" [count]="6" height="14px" />
        </aside>
        <div class="main-shell">
          <header class="topbar">
            <cl-skeleton variant="text" width="180px" height="20px" />
          </header>
          <main><cl-dashboard-skeleton /></main>
        </div>
      </div>
    } @else {
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
            <a
              class="button primary"
              href="/signin-with-chatgpt?return_to=/admin/"
              target="_top"
              >Sign in with ChatGPT</a
            ><button class="button" (click)="initialize()">Try again</button>
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
export class AdminComponent implements OnInit {
  maintenance = inject(MaintenanceState);
  pluginView = inject(PluginViewState);
  api = inject(ApiService);
  router = inject(Router);
  setup = false;
  passwordAuth = false;
  busy = false;
  error = "";
  menuOpen = false;
  section = "Dashboard";
  ngOnInit() {
    this.initialize();
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
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
    try {
      const session = await this.api.request("/admin/session");
      this.passwordAuth = session.passwordAuth === true;
      this.setup = !!session.setup;
      if (!this.setup) {
        await this.api.load();
        this.router.navigateByUrl(
          location.pathname.replace(/^\/admin/, "") || "/dashboard",
        );
      }
    } catch (e) {
      this.error = (e as Error).message;
    }
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
  get mainNavigation() {
    return this.navigation("main");
  }
  get systemNavigation() {
    return this.navigation("system");
  }
  get postCount() {
    return this.api.state()!.content.filter((c) => c.kind === "post").length;
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
