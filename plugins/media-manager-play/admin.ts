import { ChangeDetectorRef, Component, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../shared/api.service";

@Component({
  selector: "cl-media-manager-play",
  standalone: true,
  imports: [FormsModule],
  styles: `
    code {
      overflow-wrap: anywhere;
    }
    .form-content {
      display: grid;
      gap: 18px;
    }
    .status-grid {
      display: grid;
      gap: 12px;
    }
    .field-note {
      margin: 0;
    }
  `,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">MEDIA MANAGER</p>
        <h1>Play purchase verification</h1>
        <p>Use this site's HTTPS API to verify Android ad removal.</p>
      </div>
    </div>
    @if (error) {
      <p class="notice" role="alert">{{ error }}</p>
    }
    @if (notice) {
      <p class="notice" role="status">{{ notice }}</p>
    }
    @if (loading) {
      <p role="status">Checking configuration…</p>
    } @else {
      <section class="panel">
        <div class="form-content">
          <h2>Verification service</h2>
          <label class="admin-checkbox-row"
            ><input type="checkbox" [(ngModel)]="status.enabled" /><span
              >Enable purchase verification</span
            ></label
          >
          <p class="field-note">
            Activate this plugin in Plugins as well. Unconfigured or disabled
            services never grant ad removal.
          </p>
          <div class="status-grid">
            <p>
              Package: <code>{{ status.packageName }}</code> · Product:
              <code>{{ status.productId }}</code>
            </p>
            <p>
              Keyless hosting identity:
              <strong>{{
                status.identityConfigured ? "Configured" : "Setup required"
              }}</strong>
            </p>
            <p>
              Play licensing public key:
              <strong>{{
                status.receiptKeyConfigured ? "Configured" : "Setup required"
              }}</strong>
            </p>
            <p>
              Authenticated notifications:
              <strong>{{
                status.notificationsConfigured ? "Configured" : "Setup required"
              }}</strong>
            </p>
          </div>
          <p class="field-note">
            These indicators check configuration, not live Google API access.
            Configure workload identity federation in the hosting environment;
            credentials are never entered into this page.
          </p>
          <label
            >Android verification endpoint<code>{{
              status.verifyUrl
            }}</code></label
          >
          <label
            >Google Pub/Sub push endpoint<code>{{
              status.notificationsUrl
            }}</code></label
          >
          <p class="field-note">
            The Android app still needs a build configured to call this service.
            Notifications trigger a fresh Google check; the app refreshes
            ownership when online. Media files never pass through these
            endpoints.
          </p>
          <div class="actions">
            <button class="button primary" [disabled]="busy" (click)="save()">
              {{ busy ? "Saving…" : "Save settings" }}
            </button>
            <button class="button" [disabled]="busy" (click)="load()">
              Refresh configuration
            </button>
          </div>
        </div>
      </section>
    }
  `,
})
export class MediaManagerPlayComponent implements OnInit {
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  status: any = {};
  loading = true;
  busy = false;
  error = "";
  notice = "";
  ngOnInit() {
    return this.load();
  }
  async load() {
    this.loading = true;
    this.error = "";
    try {
      this.status = await this.api.request("/admin/media-manager-play");
    } catch (error) {
      this.error = (error as Error).message;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  async save() {
    this.busy = true;
    this.error = "";
    this.notice = "";
    try {
      this.status = await this.api.request(
        "/admin/media-manager-play",
        "POST",
        { enabled: this.status.enabled },
      );
      this.notice = "Verification settings saved.";
    } catch (error) {
      this.error = (error as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
