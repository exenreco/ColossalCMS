import { MediaSelectionService } from "../../../../shared/media-selection.service";
import { DialogFocusDirective } from "../../../../shared/dialog-focus.directive";
import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatePipe } from "@angular/common";
import { ApiService } from "../../../../shared/api.service";
import { IconComponent } from "../../../../shared/icon.component";
@Component({
  selector: "cl-settings",
  standalone: true,
  imports: [DialogFocusDirective, FormsModule, IconComponent, DatePipe],
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
      <div class="settings-layout">
        <nav class="settings-nav" aria-label="Settings sections">
          @for (
            t of ["General", "Appearance", "Team & roles", "API keys"];
            track t
          ) {
            <button [class.active]="tab === t" (click)="tab = t; error = ''">
              {{ t }}<cl-icon name="chevron" />
            </button>
          }
        </nav>
        <div class="settings-content">
          @if (tab === "General" || tab === "Appearance") {
            <form class="panel settings-panel" (ngSubmit)="save()">
              <div class="panel-heading">
                <div>
                  <h2>
                    {{ tab === "General" ? "Site identity" : "Look & feel" }}
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
                      Choose an image from your media library for browser tabs
                      and bookmarks.
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
                    <h3>Pages &amp; Routing</h3>
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
                } @else {
                  <label
                    >Accent color
                    <div class="color-control">
                      <input
                        type="color"
                        name="colorPicker"
                        [(ngModel)]="settings.accent"
                        aria-label="Choose accent color"
                      /><input
                        name="accent"
                        [(ngModel)]="settings.accent"
                        pattern="#[0-9a-fA-F]{6}"
                        required
                      /></div
                  ></label>
                  <div class="swatches">
                    @for (
                      color of [
                        "#246b50",
                        "#254f83",
                        "#753c59",
                        "#9a542b",
                        "#242a2d",
                      ];
                      track color
                    ) {
                      <button
                        type="button"
                        [style.background]="color"
                        [attr.aria-label]="'Use ' + color"
                        (click)="settings.accent = color"
                      >
                        @if (settings.accent === color) {
                          <cl-icon name="check" />
                        }
                      </button>
                    }
                  </div>
                  <label
                    >Logo URL<input
                      type="url"
                      name="logo"
                      [(ngModel)]="settings.logo"
                      placeholder="https://example.com/logo.svg"
                    /><small
                      >Use an HTTPS image URL, or leave blank for your site
                      name.</small
                    ></label
                  >
                  <div
                    class="brand-preview"
                    [style.border-color]="settings.accent"
                  >
                    <span class="eyebrow">LIVE PREVIEW</span>
                    <h3 [style.color]="settings.accent">
                      {{ settings.title }}
                    </h3>
                    <p>{{ settings.tagline }}</p>
                  </div>
                }
                @if (error) {
                  <p class="error" role="alert">{{ error }}</p>
                }
              </div>
              <div class="modal-footer">
                <span class="muted">Changes apply to your public site.</span
                ><button class="button primary" [disabled]="busy">
                  {{ busy ? "Saving…" : "Save changes"
                  }}<cl-icon name="check" />
                </button>
              </div>
            </form>
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
    siteIconId: "",
    postRouting: "home" as "home" | "page",
    postsPageId: "",
    notFoundPageId: "",
    routingVersion: this.api.state()!.settings.routingVersion ?? 1,
    homePageId: "",
    ...this.api.state()!.settings,
  };
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
