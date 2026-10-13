import { MediaSelectionService } from "../../../../shared/media-selection.service";
import { DialogFocusDirective } from "../../../../shared/dialog-focus.directive";
import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatePipe } from "@angular/common";
import { ApiService } from "../../../../shared/api.service";
import { IconComponent } from "../../../../shared/icon.component";
import { SmtpSettingsComponent } from "../../../../shared/smtp-settings.component";
import {
  formatPageTitle,
  TITLE_SEPARATORS,
} from "../../../../shared/page-title";
@Component({
  selector: "cl-settings",
  standalone: true,
  imports: [
    DialogFocusDirective,
    FormsModule,
    IconComponent,
    DatePipe,
    SmtpSettingsComponent,
  ],
  styles: `
    .reading-panels {
      display: grid;
      gap: 24px;
    }
    .admin-appearance-section {
      border-top: 0;
      padding-top: 0;
    }
    .settings-layout.smtp-layout {
      grid-template-columns: 180px minmax(0, 1fr);
    }
    @media (max-width: 700px) {
      .settings-layout.smtp-layout {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">THE DETAILS THAT MAKE IT YOURS</p>
        <h1>Your site, your way.</h1>
        <p>Set the tone, bring your team, and keep everything connected.</p>
      </div>
    </div>
    @if (!isAdmin) {
      <div class="panel empty-cell">
        <h2>Administrator access required</h2>
        <p>Ask your workspace administrator to update these settings.</p>
      </div>
    } @else {
      <div class="settings-layout" [class.smtp-layout]="tab === 'SMTP'">
        <nav class="settings-nav" aria-label="Settings sections">
          @for (
            t of [
              "General",
              "Reading",
              "Appearance",
              "SMTP",
              "Team & roles",
              "API keys",
            ];
            track t
          ) {
            <button [class.active]="tab === t" (click)="tab = t; error = ''">
              {{ t }}<cl-icon name="chevron" />
            </button>
          }
        </nav>
        <div class="settings-content">
          @if (tab === "SMTP") {
            <cl-smtp-settings />
          }
          @if (tab === "General" || tab === "Appearance") {
            <form class="panel settings-panel" (ngSubmit)="save()">
              <div class="panel-heading">
                <div>
                  <h2>
                    {{
                      tab === "General" ? "Site identity" : "Admin appearance"
                    }}
                  </h2>
                  <p>
                    {{
                      tab === "General"
                        ? "A name and a few words to introduce yourself."
                        : "Small details that carry your identity across the site."
                    }}
                  </p>
                </div>
              </div>
              <div class="form-content">
                @if (tab === "General") {
                  <label
                    >Site title<input
                      name="title"
                      [(ngModel)]="settings.title"
                      required
                      maxlength="80" /></label
                  ><label
                    >Tagline<textarea
                      name="tagline"
                      [(ngModel)]="settings.tagline"
                      rows="2"
                      maxlength="200"
                    ></textarea
                    ><small
                      >A short introduction shown on your public site.</small
                    ></label
                  >
                  <div class="settings-section">
                    <h3>Site icon</h3>
                    <p class="field-note">
                      Choose an image for browser tabs and bookmarks in the
                      admin and frontend.
                    </p>
                    <div class="site-icon-control">
                      @if (siteIcon) {
                        <img
                          [src]="siteIcon.url + '?v=' + siteIcon.updatedAt"
                          [alt]="siteIcon.altText"
                        />
                      }
                      <button
                        type="button"
                        class="button"
                        (click)="chooseIcon()"
                      >
                        <cl-icon name="media" />{{
                          siteIcon ? "Change site icon" : "Select site icon"
                        }}
                      </button>
                      @if (siteIcon) {
                        <button
                          type="button"
                          class="text-button"
                          (click)="settings.siteIconId = ''"
                        >
                          Remove
                        </button>
                      }
                    </div>
                  </div>
                  <div class="settings-section">
                    <h3>Site logo</h3>
                    <p class="field-note">
                      Choose an image for the site logo and Site Identity
                      blocks.
                    </p>
                    <div class="site-icon-control">
                      @if (siteLogo) {
                        <img
                          [src]="siteLogo.url + '?v=' + siteLogo.updatedAt"
                          [alt]="siteLogo.altText"
                        />
                      }
                      <button
                        type="button"
                        class="button"
                        (click)="chooseLogo()"
                      >
                        <cl-icon name="media" />{{
                          siteLogo ? "Change site logo" : "Select site logo"
                        }}
                      </button>
                      @if (siteLogo) {
                        <button
                          type="button"
                          class="text-button"
                          (click)="settings.siteLogoId = ''"
                        >
                          Remove
                        </button>
                      }
                    </div>
                  </div>
                } @else {
                  <div class="settings-section admin-appearance-section">
                    <h3>Admin appearance</h3>
                    <p class="field-note">
                      Choose the color mode for the dashboard and all editors.
                      System follows your device settings.
                    </p>
                    <label
                      >Color mode<select
                        name="adminColorMode"
                        [(ngModel)]="settings.adminColorMode"
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="system">System</option>
                      </select></label
                    >
                  </div>
                }
                @if (error) {
                  <p class="error" role="alert">{{ error }}</p>
                }
              </div>
              <div class="modal-footer">
                <span class="muted">{{
                  tab === "Appearance"
                    ? "Applies to the admin and all editors after saving."
                    : "Changes apply to your public site."
                }}</span
                ><button class="button primary" [disabled]="busy">
                  {{ busy ? "Saving…" : "Save changes"
                  }}<cl-icon name="check" />
                </button>
              </div>
            </form>
          }
          @if (tab === "Reading") {
            <div class="reading-panels">
              <form
                class="panel settings-panel"
                (ngSubmit)="saveReading('routing')"
              >
                <div class="panel-heading"><h2>Pages &amp; Routing</h2></div>
                <div class="form-content">
                  <p class="field-note">
                    Only published pages are selectable. Draft and scheduled
                    pages are excluded.
                  </p>
                  <label
                    >Home page<select
                      name="homePageId"
                      [(ngModel)]="settings.homePageId"
                      (ngModelChange)="routingChanged('homePageId')"
                    >
                      <option value="">Latest posts</option>
                      @for (page of publishedPages; track page.id) {
                        <option [value]="page.id">{{ page.title }}</option>
                      }
                    </select></label
                  >
                  <label
                    >Posts page<select
                      name="postsPageId"
                      [(ngModel)]="settings.postsPageId"
                      [disabled]="!settings.homePageId"
                      (ngModelChange)="routingChanged('postsPageId')"
                    >
                      <option value="">None</option>
                      @for (page of publishedPages; track page.id) {
                        @if (page.id !== settings.homePageId) {
                          <option [value]="page.id">{{ page.title }}</option>
                        }
                      }
                    </select></label
                  >
                  <label
                    >404 page<select
                      name="notFoundPageId"
                      [(ngModel)]="settings.notFoundPageId"
                      (ngModelChange)="routingChanged('notFoundPageId')"
                    >
                      <option value="">Theme 404 template</option>
                      @for (page of publishedPages; track page.id) {
                        <option [value]="page.id">{{ page.title }}</option>
                      }
                    </select></label
                  >
                  <p class="field-note">
                    The selected page appears on unmatched URLs through the
                    theme's 404 template. It is excluded from site navigation.
                  </p>
                </div>
                <div class="modal-footer">
                  <span class="muted">Changes apply to your public site.</span
                  ><button class="button primary" [disabled]="busy">
                    {{ busy ? "Saving…" : "Save changes"
                    }}<cl-icon name="check" />
                  </button>
                </div>
              </form>
              <form
                class="panel settings-panel"
                (ngSubmit)="saveReading('titles')"
              >
                <div class="panel-heading"><h2>Page titles</h2></div>
                <div class="form-content">
                  <label
                    >Title format<select
                      name="titleFormat"
                      [(ngModel)]="settings.titleFormat"
                    >
                      <option value="page-site">Page title | Site title</option>
                      <option value="site-page">Site title | Page title</option>
                      <option value="page-only">Page title only</option>
                      <option value="site-only">Site title only</option>
                    </select></label
                  >
                  <label
                    >Title separator<select
                      name="titleSeparator"
                      [(ngModel)]="settings.titleSeparator"
                      [disabled]="
                        settings.titleFormat === 'page-only' ||
                        settings.titleFormat === 'site-only'
                      "
                    >
                      @for (separator of titleSeparators; track separator) {
                        <option [value]="separator">{{ separator }}</option>
                      }
                    </select></label
                  >
                  <p class="field-note">
                    Applies to browser tabs, search previews and default social
                    titles. A page’s meta title supplies the page-title portion.
                  </p>
                  <p class="field-note">
                    Preview: <strong>{{ titlePreview }}</strong>
                  </p>
                </div>
                <div class="modal-footer">
                  <span class="muted">Changes apply to your public site.</span
                  ><button class="button primary" [disabled]="busy">
                    {{ busy ? "Saving…" : "Save changes"
                    }}<cl-icon name="check" />
                  </button>
                </div>
              </form>
            </div>
            @if (error) {
              <p class="error" role="alert">{{ error }}</p>
            }
          }
          @if (tab === "Team & roles") {
            <section class="panel settings-panel">
              <div class="panel-heading">
                <div>
                  <h2>A space to work together</h2>
                  <p>
                    Administrators manage the workspace. Editors manage content.
                  </p>
                </div>
              </div>
              <div class="form-content">
                <p class="info-note">
                  Site access is controlled separately by your private Site’s
                  sharing settings. Adding a member here grants a CMS role; it
                  does not send an invitation or change Site sharing.
                </p>
                <div class="members-list">
                  @for (m of api.state()!.members; track m.id) {
                    <div class="member-row">
                      <span class="avatar">{{
                        m.email.slice(0, 2).toUpperCase()
                      }}</span>
                      <div>
                        <strong>{{ m.email }}</strong
                        ><small>{{
                          m.id === "owner"
                            ? "Workspace owner"
                            : m.role === "admin"
                              ? "Administrator"
                              : "Editor"
                        }}</small>
                      </div>
                      @if (m.id !== "owner" && m.id !== api.state()!.user.id) {
                        <button
                          class="icon-button danger-text"
                          [attr.aria-label]="'Remove ' + m.email"
                          (click)="
                            confirmRemove = {
                              type: 'members',
                              id: m.id,
                              name: m.email,
                            }
                          "
                        >
                          <cl-icon name="trash" />
                        </button>
                      }
                    </div>
                  }
                </div>
                <form (ngSubmit)="addMember()">
                  <h3>Add or update a member</h3>
                  <div class="field-row">
                    <label
                      >Email<input
                        type="email"
                        name="email"
                        [(ngModel)]="email"
                        required
                        placeholder="teammate@example.com" /></label
                    ><label
                      >Role<select name="role" [(ngModel)]="role">
                        <option value="editor">Editor</option>
                        <option value="admin">Administrator</option>
                      </select></label
                    >
                  </div>
                  <button class="button primary" [disabled]="busy">
                    Save member<cl-icon name="plus" />
                  </button>
                </form>
                @if (error) {
                  <p class="error" role="alert">{{ error }}</p>
                }
              </div>
            </section>
          }
          @if (tab === "API keys") {
            <section class="panel settings-panel">
              <div class="panel-heading">
                <div>
                  <h2>Connect your content</h2>
                  <p>
                    Read-only keys provide access to published content through
                    the API.
                  </p>
                </div>
              </div>
              <div class="form-content">
                <p class="info-note">
                  Send your key as a Bearer token to <code>/api/content</code>.
                  Private Site access still applies.
                </p>
                @if (newKey) {
                  <div class="key-reveal">
                    <strong>Copy your key now. It is only shown once.</strong
                    ><textarea readonly rows="3" aria-label="New API key">{{
                      newKey
                    }}</textarea
                    ><button class="button small" (click)="newKey = ''">
                      I’ve saved it
                    </button>
                  </div>
                }
                <div class="members-list">
                  @for (k of api.state()!.keys; track k.id) {
                    <div class="member-row">
                      <cl-icon name="lock" />
                      <div>
                        <strong>{{ k.name }}</strong
                        ><small
                          >Created {{ k.createdAt | date: "MMM d, y" }}</small
                        >
                      </div>
                      <button
                        class="text-button danger-text"
                        (click)="
                          confirmRemove = {
                            type: 'keys',
                            id: k.id,
                            name: k.name,
                          }
                        "
                      >
                        Revoke
                      </button>
                    </div>
                  } @empty {
                    <p class="muted">No API keys yet.</p>
                  }
                </div>
                <form (ngSubmit)="createKey()">
                  <label
                    >Key name<input
                      name="keyName"
                      [(ngModel)]="keyName"
                      required
                      maxlength="80"
                      placeholder="e.g. My website integration" /></label
                  ><button class="button primary" [disabled]="busy">
                    Create read-only key<cl-icon name="plus" />
                  </button>
                </form>
                @if (error) {
                  <p class="error" role="alert">{{ error }}</p>
                }
              </div>
            </section>
          }
        </div>
      </div>
    }
    @if (confirmRemove) {
      <div class="modal-overlay">
        <section
          class="confirm-dialog"
          clDialogFocus
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="revoke-title"
        >
          <h2 id="revoke-title">Remove {{ confirmRemove.name }}?</h2>
          <p>
            {{
              confirmRemove.type === "keys"
                ? "This key will immediately stop working."
                : "This member will lose access to the CMS."
            }}
          </p>
          <div class="dialog-actions">
            <button class="button" (click)="confirmRemove = null">Cancel</button
            ><button class="button danger" [disabled]="busy" (click)="remove()">
              Remove access
            </button>
          </div>
        </section>
      </div>
    }
  `,
})
export class SettingsComponent {
  api = inject(ApiService);
  mediaSelection = inject(MediaSelectionService);
  tab = "General";
  routingChanged(key: "homePageId" | "postsPageId" | "notFoundPageId") {
    for (const other of [
      "homePageId",
      "postsPageId",
      "notFoundPageId",
    ] as const) {
      if (
        other !== key &&
        this.settings[key] &&
        this.settings[key] === this.settings[other]
      ) {
        if (!confirm("This page already has a routing role. Reassign it?")) {
          this.settings[key] = "";
          return;
        }
        this.settings[other] = "";
      }
    }
    if (!this.settings.homePageId) this.settings.postsPageId = "";
    this.settings.postRouting = this.settings.homePageId ? "page" : "home";
    this.settings.routingVersion = 2;
  }
  settings = {
    titleFormat: "page-site" as
      "page-site" | "site-page" | "page-only" | "site-only",
    titleSeparator: "·",
    adminColorMode: "system" as "light" | "dark" | "system",
    siteIconId: "",
    siteLogoId: "",
    postRouting: "home" as "home" | "page",
    postsPageId: "",
    notFoundPageId: "",
    routingVersion: this.api.state()!.settings.routingVersion ?? 1,
    homePageId: "",
    ...this.api.state()!.settings,
  };
  titleSeparators = TITLE_SEPARATORS;
  get titlePreview() {
    return formatPageTitle("About us", this.settings);
  }
  busy = false;
  error = "";
  email = "";
  role = "editor";
  keyName = "";
  newKey = "";
  confirmRemove: { type: string; id: string; name: string } | null = null;
  get siteIcon() {
    return this.api
      .state()!
      .media.find((m) => m.id === this.settings.siteIconId);
  }
  get siteLogo() {
    return this.api
      .state()!
      .media.find((m) => m.id === this.settings.siteLogoId);
  }
  async chooseLogo() {
    const [item] = await this.mediaSelection.open({
      accept: ["image"],
      initialSelectionIds: this.settings.siteLogoId
        ? [this.settings.siteLogoId]
        : [],
    });
    if (item) this.settings.siteLogoId = item.id;
  }
  get publishedPages() {
    return this.api
      .state()!
      .content.filter((c) => c.kind === "page" && c.status === "published");
  }
  async chooseIcon() {
    const [item] = await this.mediaSelection.open({
      accept: ["image"],
      initialSelectionIds: this.settings.siteIconId
        ? [this.settings.siteIconId]
        : [],
    });
    if (item) this.settings.siteIconId = item.id;
  }
  get isAdmin() {
    return this.api.state()!.user.role === "admin";
  }
  async act(path: string, method: string, body: unknown, message: string) {
    this.busy = true;
    this.error = "";
    try {
      return await this.api.mutate(path, method, body, message);
    } catch (e) {
      this.error = (e as Error).message;
      return null;
    } finally {
      this.busy = false;
    }
  }
  async saveReading(section: "titles" | "routing") {
    const keys =
      section === "titles"
        ? (["titleFormat", "titleSeparator"] as const)
        : ([
            "postRouting",
            "postsPageId",
            "homePageId",
            "notFoundPageId",
            "routingVersion",
          ] as const);
    await this.act(
      "/admin/settings",
      "POST",
      Object.fromEntries(keys.map((key) => [key, this.settings[key]])),
      section === "titles"
        ? "Page title settings saved."
        : "Page routing settings saved.",
    );
  }
  async save() {
    await this.act(
      "/admin/settings",
      "POST",
      this.settings,
      "Site settings saved.",
    );
  }
  async addMember() {
    if (
      await this.act(
        "/admin/members",
        "POST",
        { email: this.email, role: this.role },
        "Workspace access updated.",
      )
    )
      this.email = "";
  }
  async createKey() {
    const result = await this.act(
      "/admin/keys",
      "POST",
      { name: this.keyName },
      "Read-only API key created.",
    );
    if (result) {
      this.newKey = result.key;
      this.keyName = "";
    }
  }
  async remove() {
    if (!this.confirmRemove) return;
    if (
      await this.act(
        "/admin/" + this.confirmRemove.type + "/" + this.confirmRemove.id,
        "DELETE",
        {},
        "Access removed.",
      )
    )
      this.confirmRemove = null;
  }
}
