import { DialogFocusDirective } from "../../../../shared/dialog-focus.directive";
import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../../../shared/api.service";
import { IconComponent } from "../../../../shared/icon.component";
import { Plugin } from "../../../../shared/models";
@Component({
  selector: "cl-plugins",
  standalone: true,
  imports: [DialogFocusDirective, FormsModule, IconComponent],
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">BUILT TO GROW WITH YOU</p>
        <h1>A little extra possibility.</h1>
        <p>One connected workspace. The building blocks are up to you.</p>
      </div>
      <button
        class="button primary"
        [disabled]="!isAdmin"
        (click)="uploadOpen = !uploadOpen"
      >
        <cl-icon name="plus" />Upload plugin
      </button>
    </div>
    @if (uploadOpen) {
      <section class="panel plugin-upload-panel">
        <h2>Install a plugin ZIP</h2>
        <p>
          The archive must contain a valid V2 manifest at its root and be no
          larger than 25 MB. Installed uploads remain inactive.
        </p>
        <div class="plugin-upload-row">
          <input
            type="file"
            accept=".zip"
            aria-label="Choose plugin ZIP"
            (change)="pickZip($event)"
          /><button
            class="button primary"
            [disabled]="!zipFile || busy"
            (click)="uploadZip()"
          >
            {{ busy ? "Installing…" : "Install ZIP" }}</button
          ><button
            class="button"
            [disabled]="busy"
            (click)="uploadOpen = false"
          >
            Close
          </button>
        </div>
        @if (busy) {
          <progress max="100" [value]="progress"></progress>
        }
        <p class="plugin-review-note">
          Uploaded plugin execution is disabled in this workspace pending
          approval. Bundled extensions remain available.
        </p>
      </section>
    }
    <div class="plugin-banner">
      <span class="plugin-banner-icon"><cl-icon name="plugins" /></span>
      <div>
        <h2>A strong core. An open horizon.</h2>
        <p>
          Core plugins keep your site running. Extensions help you make it your
          own.
        </p>
      </div>
      <span class="badge core"><cl-icon name="lock" />7 core plugins</span>
    </div>
    <div class="content-toolbar standalone">
      <div class="tabs">
        @for (t of ["Installed", "Available"]; track t) {
          <button [class.selected]="tab === t" (click)="tab = t">
            {{ t }}
          </button>
        }
      </div>
      <label class="search-field"
        ><cl-icon name="search" /><input
          [(ngModel)]="search"
          placeholder="Find a plugin…"
          aria-label="Find a plugin"
      /></label>
    </div>
    @if (error) {
      <p class="error" role="alert">{{ error }}</p>
    }
    <div class="plugin-grid">
      @for (p of filtered; track p.id) {
        <article class="plugin-card">
          <div class="plugin-card-top">
            <span class="plugin-tile" [class.extension]="!p.isCore"
              ><cl-icon [name]="p.icon"
            /></span>
            @if (p.isCore) {
              <span class="badge core"><cl-icon name="lock" />Core</span>
            } @else {
              <span [class]="'badge ' + (p.active ? 'published' : 'draft')"
                ><span></span
                >{{
                  p.active ? "Active" : p.installed ? "Inactive" : "Available"
                }}</span
              >
            }
          </div>
          <h2>{{ p.name }}</h2>
          <p>{{ p.description }}</p>
          <div class="plugin-meta">
            v{{ p.version }} <span>by {{ p.author }}</span>
          </div>
          @if (p.uploaded) {
            <p class="plugin-review-note">
              Uploaded archive · {{ p.license }}
              @if (p.pending) {
                · Awaiting activation
              }
            </p>
          }
          <div class="plugin-card-footer">
            @if (p.isCore) {
              <span class="locked-note"
                ><cl-icon name="lock" />Always active</span
              ><span class="subtle-label">Essential</span>
            } @else if (p.installed) {
              <button
                class="text-button"
                [disabled]="busy || !isAdmin || !!p.uploaded"
                (click)="change(p, p.active ? 'deactivate' : 'activate')"
              >
                {{
                  p.uploaded
                    ? "Activation disabled"
                    : p.active
                      ? "Deactivate"
                      : "Activate"
                }}</button
              ><button
                class="text-button danger-text"
                [disabled]="busy || !isAdmin"
                (click)="removing = p"
              >
                Uninstall
              </button>
            } @else {
              <button
                class="button small primary"
                [disabled]="busy || !isAdmin"
                (click)="change(p, 'install')"
              >
                <cl-icon name="plus" />Install plugin
              </button>
            }
          </div>
          @if (p.uploaded && p.previousRevision) {
            <div class="plugin-card-footer">
              <button
                class="text-button"
                [disabled]="busy || !isAdmin"
                (click)="change(p, 'rollback')"
              >
                Restore previous version
              </button>
            </div>
          }
        </article>
      } @empty {
        <div class="empty-cell panel">
          <h3>{{ search ? "No matching plugins" : "You’re all set." }}</h3>
          <p>
            {{
              search
                ? "Try another search."
                : "All bundled extensions are installed."
            }}
          </p>
        </div>
      }
    </div>
    <p class="catalog-note">
      <cl-icon name="book" />Bundle extensions or upload a V2 ZIP. Uploaded
      archives are validated and stored inactive.
    </p>
    @if (removing) {
      <div class="modal-overlay">
        <section
          class="confirm-dialog"
          clDialogFocus
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="uninstall-title"
        >
          <h2 id="uninstall-title">Uninstall {{ removing.name }}?</h2>
          <p>
            Its features will be removed from your site. Your content and plugin
            settings will be kept if you reinstall.
          </p>
          <div class="dialog-actions">
            <button class="button" (click)="removing = null">Cancel</button
            ><button
              class="button danger"
              [disabled]="busy"
              (click)="change(removing, 'uninstall')"
            >
              Uninstall plugin
            </button>
          </div>
        </section>
      </div>
    }
  `,
})
export class PluginsComponent {
  api = inject(ApiService);
  tab = "Installed";
  search = "";
  busy = false;
  error = "";
  removing: Plugin | null = null;
  uploadOpen = false;
  zipFile: File | null = null;
  progress = 0;
  pickZip(event: Event) {
    this.zipFile = (event.target as HTMLInputElement).files?.[0] || null;
  }
  async uploadZip() {
    if (!this.zipFile) return;
    this.busy = true;
    this.error = "";
    this.progress = 0;
    try {
      const form = new FormData();
      form.set("file", this.zipFile);
      await this.api.upload(
        "/plugins/install",
        form,
        (p) => (this.progress = p),
      );
      await this.api.load();
      this.uploadOpen = false;
      this.zipFile = null;
      this.tab = "Installed";
      this.api.toast("Plugin validated and stored inactive.");
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
    }
  }
  get isAdmin() {
    return this.api.state()!.user.role === "admin";
  }
  get installedCount() {
    return this.api.state()!.plugins.filter((p) => p.installed).length;
  }
  get filtered() {
    return this.api
      .state()!
      .plugins.filter(
        (p) =>
          p.installed === (this.tab === "Installed") &&
          (p.name + " " + p.description)
            .toLowerCase()
            .includes(this.search.toLowerCase()),
      );
  }
  async change(p: Plugin, action: string) {
    this.busy = true;
    this.error = "";
    try {
      await this.api.mutate(
        p.uploaded
          ? "/plugins/" + encodeURIComponent(p.id) + "/" + action
          : "/admin/plugins",
        "POST",
        { id: p.id, action },
        p.name + " updated.",
      );
      this.removing = null;
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
    }
  }
}
