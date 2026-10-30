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
          <h2>Encrypted verification settings</h2>
          <p class="field-note">
            All three fields are encrypted in the database. Leave a saved field
            blank to keep its current value. Saved values are never returned to
            this page.
          </p>
          @if (!status.storageWritable) {
            <p class="notice" role="alert">
              Database encryption is unavailable. Configure CMS_ENCRYPTION_KEY
              in the hosting secrets; the master encryption key stays outside
              the database.
            </p>
          }
          @for (field of fields; track field.key) {
            <label
              >{{ field.label }}
              <input
                type="password"
                autocomplete="new-password"
                spellcheck="false"
                [ngModel]="credentials[field.key]"
                (ngModelChange)="credentials[field.key] = $event"
                [disabled]="
                  busy ||
                  !status.storageWritable ||
                  status.credentials?.[field.key]?.managed
                "
                [placeholder]="
                  status.credentials?.[field.key]?.configured
                    ? 'Saved — leave blank to keep'
                    : field.placeholder
                "
              />
            </label>
            @if (status.credentials?.[field.key]?.managed) {
              <p class="field-note">
                Managed by hosting environment. Migrate to encrypted storage and
                remove the hosting override before replacing it here.
              </p>
            } @else if (
              status.credentials?.[field.key]?.source === "database"
            ) {
              <p class="field-note">Saved encrypted in database.</p>
            }
          }
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
            Save the public key, provider audience and service account above.
            Workload identity federation must still be configured in Google
            Cloud; the deployment identity token is supplied by the host, not
            stored here.
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
  credentials: Record<string, string> = {
    publicKey: "",
    audience: "",
    serviceAccount: "",
  };
  readonly fields = [
    {
      key: "publicKey",
      label: "Play licensing public key",
      placeholder: "Base64 RSA licensing public key",
    },
    {
      key: "audience",
      label: "Workload identity provider audience",
      placeholder:
        "//iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER",
    },
    {
      key: "serviceAccount",
      label: "Verifier service account",
      placeholder:
        "media-manager-play-verifier@portfolio-457414.iam.gserviceaccount.com",
    },
  ];
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
      this.credentials = { publicKey: "", audience: "", serviceAccount: "" };
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
        { enabled: this.status.enabled, credentials: this.credentials },
      );
      this.credentials = { publicKey: "", audience: "", serviceAccount: "" };
      this.notice =
        "Verification settings saved. Configuration values are encrypted in the database.";
    } catch (error) {
      this.error = (error as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
