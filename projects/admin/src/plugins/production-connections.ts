import {
  Component,
  ChangeDetectorRef,
  OnInit,
  OnDestroy,
  inject,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../../../shared/api.service";

interface EnvField {
  key: string;
  label: string;
  group: string;
  secret?: boolean;
  options?: string[];
  value: string;
  configured: boolean;
  managed: boolean;
}
interface Run {
  id: string;
  status: string;
  action: string;
  logs: { time: string; message: string }[];
}
@Component({
  selector: "cl-production-connections",
  standalone: true,
  imports: [FormsModule],
  styles: `
    .connection-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(300px, 0.85fr);
      gap: 24px;
      align-items: start;
    }
    .connection-panel {
      padding: 24px;
    }
    .connection-panel h2 {
      margin-top: 0;
    }
    .connection-panel p {
      line-height: 1.6;
      color: #637366;
    }
    .connection-status {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin: 0 0 24px;
    }
    .connection-status span {
      padding: 8px 12px;
      background: #e9f0e6;
      border-radius: 8px;
      font-size: 13px;
    }
    .env-field {
      margin: 18px 0;
    }
    .env-field label {
      display: block;
      font-size: 14px;
      font-weight: 550;
      margin-bottom: 8px;
    }
    .env-field code {
      display: block;
      font-size: 11px;
      color: #718171;
      margin-top: 4px;
    }
    .env-input {
      display: flex;
      gap: 8px;
    }
    .env-input input,
    .env-input select {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      border: 1px solid #dce4da;
      border-radius: 6px;
      padding: 11px;
      background: white;
      color: #294432;
      font: inherit;
    }
    .env-field small {
      display: block;
      margin-top: 7px;
      color: #687b6b;
    }
    .env-input button {
      white-space: nowrap;
    }
    .connection-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 24px;
    }
    .migration-choice {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-top: 18px;
      font-size: 14px;
      line-height: 1.5;
      cursor: pointer;
    }
    .migration-choice input {
      margin-top: 4px;
      accent-color: #245d47;
    }
    .connection-console {
      background: #10231d;
      color: #d7eadc;
      padding: 18px;
      border-radius: 10px;
      min-height: 200px;
      max-height: 460px;
      overflow: auto;
      white-space: pre-wrap;
      font:
        12px/1.8 ui-monospace,
        monospace;
      overflow-wrap: anywhere;
    }
    .console-line time {
      color: #95b49d;
      margin-right: 8px;
    }
    .console-state {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .error {
      color: #a42d2d;
    }
    .connection-password {
      margin-top: 24px;
    }
    @media (max-width: 1000px) {
      .connection-layout {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">PRODUCTION CONNECTIONS</p>
        <h1>Your data. Your infrastructure.</h1>
        <p>
          Configure production databases and storage while keeping development
          local.
        </p>
      </div>
    </div>
    @if (loading) {
      <section class="panel connection-panel" role="status">
        Loading server configuration…
      </section>
    } @else {
      <div class="connection-status">
        <span
          >Running database: <strong>{{ info.active.database }}</strong></span
        ><span
          >Running storage: <strong>{{ info.active.storage }}</strong></span
        ><span>{{
          info.runtime === "node"
            ? "Server environment configuration"
            : "Cloudflare bindings"
        }}</span>
      </div>
      @if (info.readOnly) {
        <section class="panel connection-panel">
          <h2>Host-managed connections</h2>
          <p>{{ info.message }}</p>
        </section>
      } @else {
        <div class="connection-layout">
          <form
            class="panel connection-panel"
            (ngSubmit)="save()"
            autocomplete="off"
          >
            <h2>Production environment</h2>
            <p>
              Saved to <code>.env.production</code> on this server. Hosting
              environment variables take precedence and are managed in your host
              dashboard. Restart production after changes; this development
              workflow uses SQLite and local files.
            </p>
            @for (group of groups; track group.id) {
              @if (groupVisible(group.id)) {
                <h3>{{ group.label }}</h3>
                @for (field of fields; track field.key) {
                  @if (field.group === group.id) {
                    <div class="env-field">
                      <label [for]="field.key"
                        >{{ field.label }}<code>{{ field.key }}</code></label
                      >
                      <div class="env-input">
                        @if (field.options) {
                          <select
                            [id]="field.key"
                            [name]="field.key"
                            [(ngModel)]="values[field.key]"
                            [disabled]="field.managed || busy"
                          >
                            @for (option of field.options; track option) {
                              <option [value]="option">
                                {{
                                  option === "mongodb"
                                    ? "MongoDB"
                                    : option === "gridfs"
                                      ? "MongoDB GridFS"
                                      : option
                                }}
                              </option>
                            }
                          </select>
                        } @else {
                          <input
                            [id]="field.key"
                            [name]="field.key"
                            [type]="
                              field.secret && !shown[field.key]
                                ? 'password'
                                : 'text'
                            "
                            [(ngModel)]="values[field.key]"
                            [disabled]="field.managed || busy"
                            [placeholder]="
                              field.secret && field.configured
                                ? 'Saved value — leave blank to keep'
                                : ''
                            "
                            [attr.autocomplete]="
                              field.secret ? 'new-password' : 'off'
                            "
                            maxlength="4096"
                            spellcheck="false"
                          />
                        }
                        @if (field.secret) {
                          <button
                            type="button"
                            class="button"
                            (click)="toggle(field)"
                            [disabled]="busy"
                            [attr.aria-label]="
                              (shown[field.key] ? 'Hide ' : 'Show ') +
                              field.label
                            "
                          >
                            {{ shown[field.key] ? "Hide" : "Show" }}
                          </button>
                        }
                      </div>
                      @if (field.key === "MONGODB_DNS_SERVERS") {
                        <small
                          >Comma-separated DNS server IPs for Node.js SRV/TXT
                          lookups. Leave blank for system DNS. Restart Node
                          after changing this setting.</small
                        >
                      }
                      @if (field.managed) {
                        <small>Managed by the hosting environment.</small>
                      } @else if (field.secret && field.configured) {
                        <small
                          >Configured. Hidden values are never included in the
                          initial response.</small
                        >
                      }
                    </div>
                  }
                }
              }
            }
            <div class="connection-actions">
              <button class="button primary" [disabled]="busy || running">
                {{ busy ? "Saving…" : "Save environment" }}
              </button>
            </div>
            @if (error) {
              <p class="error" role="alert">{{ error }}</p>
            }
          </form>
          <div>
            <section class="panel connection-panel">
              <h2>Connection console</h2>
              <p>
                Save your configuration, then test connectivity or create the
                required schemas and indexes. Built-in themes, plugins, default
                settings and sample data are installed automatically. Your setup
                administrator is also registered when production has no owner,
                using their existing password. Check below to also copy your
                local content, other members and uploaded files.
              </p>
              <label class="migration-choice">
                <input
                  type="checkbox"
                  [(ngModel)]="migrateLocal"
                  [disabled]="busy || running || !info.migration?.available"
                />
                <span>Migrate local data to production</span>
              </label>
              <p>
                Initialization copies checked local data without deleting the
                source. Production edits and conflicting files are preserved.
                Completed batches can be retried after a failure.
              </p>
              @if (!info.migration?.available) {
                <p>
                  Local SQLite data is unavailable on this server. Run migration
                  from your development server.
                </p>
              }
              <p class="console-state" role="status">
                {{ run?.status || "Ready" }}
              </p>
              <div
                class="connection-console"
                role="log"
                aria-live="polite"
                aria-label="Connection operations"
              >
                @if (!run) {
                  <span>Waiting for a connection run.</span>
                } @else {
                  @for (line of run.logs; track $index) {
                    <div class="console-line">
                      <time>{{ line.time.slice(11, 19) }}</time
                      >{{ line.message }}
                    </div>
                  }
                }
              </div>
              <div class="connection-actions">
                <button
                  type="button"
                  class="button"
                  (click)="start('test')"
                  [disabled]="busy || running || dirty"
                >
                  Test connections</button
                ><button
                  type="button"
                  class="button primary"
                  (click)="start('initialize')"
                  [disabled]="busy || running || dirty"
                >
                  Connect & initialize schemas
                </button>
              </div>
              @if (dirty) {
                <p>Save environment changes before starting a run.</p>
              }
            </section>
            <form
              class="panel connection-panel connection-password"
              (ngSubmit)="setPassword()"
            >
              <h2>Member password</h2>
              <p>
                Enter an email and password to add or update a member in this
                workspace. New members have the Editor role and can sign in on
                Node production hosting. Passwords use bcrypt with cost 12;
                setting one revokes that member's existing sessions.
              </p>
              <div class="env-field">
                <label for="member-email">Member email</label>
                <div class="env-input">
                  <input
                    id="member-email"
                    name="memberEmail"
                    type="email"
                    [(ngModel)]="memberEmail"
                    autocomplete="off"
                    required
                  />
                </div>
              </div>
              <div class="env-field">
                <label for="member-password">New password</label>
                <div class="env-input">
                  <input
                    id="member-password"
                    name="memberPassword"
                    [type]="showPassword ? 'text' : 'password'"
                    [(ngModel)]="memberPassword"
                    minlength="12"
                    autocomplete="new-password"
                    required
                  /><button
                    type="button"
                    class="button"
                    (click)="showPassword = !showPassword"
                  >
                    {{ showPassword ? "Hide" : "Show" }}
                  </button>
                </div>
              </div>
              <button class="button" [disabled]="busy">
                Set member password
              </button>
              @if (passwordError) {
                <p class="error" role="alert">{{ passwordError }}</p>
              }
            </form>
          </div>
        </div>
      }
    }
  `,
})
export class ProductionConnectionsComponent implements OnInit, OnDestroy {
  api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  info: any = { active: { database: "sqlite", storage: "local" } };
  fields: EnvField[] = [];
  values: Record<string, string> = {};
  shown: Record<string, boolean> = {};
  private original: Record<string, string> = {};
  groups = [
    { id: "setup", label: "Administrator setup" },
    { id: "database", label: "Database provider" },
    { id: "mongodb", label: "MongoDB" },
    { id: "d1", label: "Cloudflare D1" },
    { id: "storage", label: "Storage provider" },
    { id: "r2", label: "R2 / S3-compatible storage" },
    { id: "gridfs", label: "MongoDB GridFS storage" },
  ];
  loading = true;
  busy = false;
  error = "";
  run: Run | null = null;
  memberEmail = "";
  memberPassword = "";
  showPassword = false;
  migrateLocal = false;
  passwordError = "";
  private timer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  get running() {
    return this.run?.status === "running";
  }
  get dirty() {
    return Object.keys(this.values).some(
      (k) => this.values[k] !== this.original[k],
    );
  }
  groupVisible(group: string) {
    if (group === "mongodb")
      return (
        this.values["CMS_DB_PROVIDER"] === "mongodb" ||
        this.values["CMS_STORAGE_PROVIDER"] === "gridfs"
      );
    if (group === "d1") return this.values["CMS_DB_PROVIDER"] === "d1";
    if (group === "r2" || group === "gridfs")
      return this.values["CMS_STORAGE_PROVIDER"] === group;
    return true;
  }
  apply(info: any) {
    this.info = info;
    this.fields = info.fields;
    this.values = Object.fromEntries(this.fields.map((f) => [f.key, f.value]));
    this.original = { ...this.values };
    this.shown = {};
  }
  async ngOnInit() {
    try {
      this.apply(await this.api.request("/admin/connections"));
    } catch (e) {
      this.error = (e as Error).message;
      this.api.toast(this.error);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    clearTimeout(this.timer);
    for (const field of this.fields)
      if (field.secret) this.values[field.key] = "";
    this.memberPassword = "";
  }
  async toggle(field: EnvField) {
    if (this.shown[field.key]) {
      this.shown[field.key] = false;
      return;
    }
    try {
      if (!this.values[field.key] && field.configured) {
        const data = await this.api.request(
          "/admin/connections/reveal",
          "POST",
          { key: field.key },
        );
        this.values[field.key] = data.value;
        this.original[field.key] = data.value;
      }
      this.shown[field.key] = true;
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.cdr.markForCheck();
    }
  }
  async save() {
    this.busy = true;
    this.error = "";
    try {
      const input = Object.fromEntries(
        this.fields
          .filter((f) => !f.managed)
          .map((f) => [f.key, this.values[f.key]]),
      );
      this.apply(
        await this.api.request("/admin/connections/save", "POST", input),
      );
      this.api.toast(
        "Production environment saved. Restart production to apply it.",
      );
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
  async start(action: string) {
    this.busy = true;
    this.error = "";
    try {
      const { id } = await this.api.request("/admin/connections/run", "POST", {
        action,
        migrateLocal: action === "initialize" && this.migrateLocal,
      });
      await this.poll(id);
    } catch (e) {
      this.error = (e as Error).message;
      this.run = {
        id: "",
        action,
        status: "failed",
        logs: [
          {
            time: new Date().toISOString(),
            message: "Connection run could not start: " + this.error,
          },
        ],
      };
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
  private async poll(id: string) {
    if (this.destroyed) return;
    try {
      this.run = await this.api.request("/admin/connections/runs/" + id);
      if (this.running) this.timer = setTimeout(() => void this.poll(id), 700);
    } catch (e) {
      this.error = (e as Error).message;
      if (this.run) this.run.status = "failed";
    } finally {
      this.cdr.markForCheck();
    }
  }
  async setPassword() {
    this.busy = true;
    this.passwordError = "";
    try {
      await this.api.request("/admin/connections/password", "POST", {
        email: this.memberEmail,
        password: this.memberPassword,
      });
      this.memberPassword = "";
      this.showPassword = false;
      this.api.toast("Member password saved. Existing sessions were revoked.");
    } catch (e) {
      this.passwordError = (e as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
