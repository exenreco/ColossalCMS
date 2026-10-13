import { Component, OnInit, ChangeDetectorRef, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "./api.service";

@Component({
  selector: "cl-smtp-settings",
  standalone: true,
  imports: [FormsModule],
  styles: `
    .smtp-panels {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(250px, 1fr);
      gap: 24px;
      align-items: start;
    }
    .smtp-panels .settings-panel {
      max-width: none;
      min-width: 0;
    }
    .smtp-fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px;
    }
    .smtp-fields label {
      display: grid;
      gap: 8px;
      min-width: 0;
    }
    .smtp-fields :is(input, select) {
      width: 100%;
      box-sizing: border-box;
    }
    .smtp-actions {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 24px;
    }
    .smtp-enabled {
      display: flex !important;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
    }
    .smtp-enabled input[type="checkbox"] {
      width: 16px;
      height: 16px;
      flex: 0 0 16px;
      margin: 0;
      padding: 0;
    }
    .smtp-password input {
      min-width: 0;
      flex: 1;
    }
    .smtp-password {
      display: flex;
      gap: 8px;
    }
    .smtp-feedback {
      margin-top: 16px;
    }
    @media (max-width: 1100px) {
      .smtp-fields {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 900px) {
      .smtp-panels {
        grid-template-columns: 1fr;
      }
      .smtp-fields {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <div class="smtp-panels">
      <form class="panel settings-panel smtp-config" (ngSubmit)="save()">
        <div class="panel-heading">
          <div>
            <h2>SMTP</h2>
            <p>One mail configuration for your site and its plugins.</p>
          </div>
        </div>
        <div class="form-content">
          @if (loading) {
            <p>Loading SMTP settings…</p>
          } @else {
            <label class="smtp-enabled"
              ><input
                type="checkbox"
                name="enabled"
                [(ngModel)]="settings.enabled"
              />Enable outgoing mail</label
            >
            <div class="smtp-fields">
              <label
                >Provider<select
                  name="provider"
                  [(ngModel)]="settings.provider"
                >
                  <option value="mail2world">Mail2World</option>
                  <option value="custom">Other SMTP provider</option>
                </select></label
              >
              <label
                >SMTP host<input
                  name="host"
                  [(ngModel)]="settings.host"
                  placeholder="Outgoing server supplied by your provider"
                  maxlength="253"
              /></label>
              <label
                >Port<input
                  name="port"
                  type="number"
                  min="1"
                  max="65535"
                  [(ngModel)]="settings.port"
              /></label>
              <label
                >Encryption<select
                  name="encryption"
                  [(ngModel)]="settings.encryption"
                >
                  <option value="starttls">STARTTLS</option>
                  <option value="tls">TLS / SSL</option></select
                ><small
                  >Usually STARTTLS on 587 or TLS on 465. Match your provider’s
                  settings.</small
                ></label
              >
              <label
                >From email<input
                  name="fromEmail"
                  type="email"
                  [(ngModel)]="settings.fromEmail"
                  maxlength="254"
              /></label>
              <label
                >From name<input
                  name="fromName"
                  [(ngModel)]="settings.fromName"
                  maxlength="254"
              /></label>
              <label
                >Reply-to email<input
                  name="replyTo"
                  type="email"
                  [(ngModel)]="settings.replyTo"
                  maxlength="254"
              /></label>
              <label
                >SMTP username<input
                  name="username"
                  [(ngModel)]="username"
                  [disabled]="
                    credentials.readOnly || credentials.usernameManaged
                  "
                  autocomplete="off"
                /><small
                  >Encrypted database setting; environment overrides are
                  supported.</small
                ></label
              >
              <label
                >SMTP password
                <div class="smtp-password">
                  <input
                    name="password"
                    [type]="showPassword ? 'text' : 'password'"
                    [(ngModel)]="password"
                    [disabled]="
                      credentials.readOnly || credentials.passwordManaged
                    "
                    autocomplete="new-password"
                    [placeholder]="
                      credentials.passwordConfigured
                        ? 'Configured — leave blank to keep'
                        : 'Account password or app password'
                    "
                  /><button
                    type="button"
                    class="button"
                    (click)="showPassword = !showPassword"
                  >
                    {{ showPassword ? "Hide" : "Show" }}
                  </button>
                </div>
                <small
                  >Saved passwords are encrypted and never returned to the
                  browser.</small
                ></label
              >
            </div>
            @if (settings.provider === "mail2world") {
              <p class="field-note">
                Use the outgoing SMTP host supplied for your Mail2World account.
                Confirm your account includes SMTP access.
              </p>
            }
            @if (credentials.readOnly) {
              <p class="info-note">
                Configure CMS_ENCRYPTION_KEY in your hosting secrets and
                redeploy to save credentials here. Existing SMTP environment
                credentials remain supported.
              </p>
            }
            @if (!credentials.available) {
              <p class="info-note">
                Mail sending is available on Node hosting. This runtime has no
                SMTP adapter.
              </p>
            }
            <div class="smtp-actions">
              <button class="button primary" [disabled]="busy">
                {{ busy ? "Working…" : "Save SMTP settings" }}</button
              ><button
                type="button"
                class="button"
                [disabled]="busy || !settings.enabled || !credentials.available"
                (click)="check()"
              >
                Verify connection
              </button>
            </div>
          }
        </div>
      </form>
      <form class="panel settings-panel smtp-test" (ngSubmit)="test()">
        <div class="panel-heading">
          <div>
            <h2>Test email</h2>
            <p>Check delivery using your saved SMTP configuration.</p>
          </div>
        </div>
        <div class="form-content">
          <p>
            Save your settings first. Verify connection checks authentication
            without sending mail. Send test email submits a message to the
            recipient below.
          </p>
          <label
            >Recipient<input
              name="testRecipient"
              type="email"
              required
              [(ngModel)]="testRecipient"
          /></label>
          <div class="smtp-actions">
            <button
              class="button"
              [disabled]="
                loading || busy || !settings.enabled || !credentials.available
              "
            >
              Send test email
            </button>
          </div>
        </div>
      </form>
    </div>
    <div class="smtp-feedback">
      @if (error) {
        <p class="error" role="alert">{{ error }}</p>
      }
      @if (message) {
        <p class="info-note" role="status">{{ message }}</p>
      }
    </div>
  `,
})
export class SmtpSettingsComponent implements OnInit {
  api = inject(ApiService);
  cdr = inject(ChangeDetectorRef);
  settings = {
    enabled: false,
    provider: "mail2world",
    host: "",
    port: 587,
    encryption: "starttls",
    fromEmail: "",
    fromName: "",
    replyTo: "",
  };
  credentials = {
    available: false,
    readOnly: false,
    usernameManaged: false,
    passwordManaged: false,
    passwordConfigured: false,
  };
  username = "";
  originalUsername = "";
  password = "";
  showPassword = false;
  testRecipient = this.api.state()?.user.email || "";
  loading = true;
  busy = false;
  error = "";
  message = "";
  async ngOnInit() {
    try {
      await this.load();
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  async load() {
    const data = await this.api.request("/admin/settings/smtp");
    this.settings = data.settings;
    this.credentials = data.credentials;
    this.username = data.credentials.username || "";
    this.originalUsername = this.username;
    this.password = "";
  }
  async run(fn: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this.message = "";
    try {
      await fn();
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
  async save() {
    await this.run(async () => {
      const body: any = { settings: this.settings };
      if (this.username !== this.originalUsername)
        body.username = this.username;
      if (this.password) body.password = this.password;
      await this.api.request("/admin/settings/smtp", "POST", body);
      await this.load();
      this.message = "SMTP settings saved.";
    });
  }
  async check() {
    await this.run(async () => {
      await this.api.request("/admin/settings/smtp/verify", "POST", {});
      this.message = "SMTP connection verified. No email was sent.";
    });
  }
  async test() {
    await this.run(async () => {
      const result = await this.api.request(
        "/admin/settings/smtp/test",
        "POST",
        { to: this.testRecipient },
      );
      this.message = result.rejected
        ? "SMTP accepted some recipients but rejected others."
        : "SMTP accepted the test email. Check the recipient’s inbox and spam folder.";
    });
  }
}
