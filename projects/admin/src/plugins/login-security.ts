import { ChangeDetectorRef, Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatePipe } from "@angular/common";
import { ApiService } from "../../../../shared/api.service";

@Component({
  standalone: true,
  imports: [FormsModule, DatePipe],
  selector: "cl-login-security",
  styles: [
    `
      :host {
        display: block;
      }
      .security-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
      }
      .security-card {
        padding: 24px;
      }
      .fields {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      label {
        display: grid;
        gap: 8px;
        margin: 12px 0;
      }
      .toggle {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .toggle input {
        width: auto;
      }
      input {
        width: 100%;
      }
      small,
      .muted {
        color: var(--muted, #64736a);
      }
      .table-wrap {
        overflow: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 600px;
      }
      th,
      td {
        text-align: left;
        padding: 12px;
        border-bottom: 1px solid var(--line, #e2e8e3);
      }
      th {
        font-size: 12px;
        color: var(--muted, #64736a);
      }
      .ip {
        font-family: monospace;
      }
      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .section-header input {
        max-width: 280px;
      }
      .status {
        padding: 4px 8px;
        border-radius: 6px;
        background: #eef3f0;
        font-size: 12px;
      }
      .error {
        color: #a13333;
      }
      .section {
        margin-top: 24px;
      }
      h2 {
        margin-top: 0;
      }
      @media (max-width: 850px) {
        .security-grid,
        .fields {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  template: `
    <div class="page-heading section-header">
      <div>
        <p class="eyebrow">SECURITY</p>
        <h1>Login Security</h1>
        <p>Monitor sign-ins and control which IP addresses can sign in.</p>
      </div>
      <button
        class="button"
        type="button"
        (click)="load()"
        [disabled]="busy || loading"
      >
        {{ loading ? "Refreshing…" : "Refresh activity" }}
      </button>
    </div>
    @if (error) {
      <p class="error" role="alert">{{ error }}</p>
    }
    @if (data) {
      @if (!data.passwordAuth) {
        <p class="panel security-card">
          This host uses external authentication. These controls protect
          Colossal's password login on Node and Vercel hosting.
        </p>
      }
      @if (!data.active) {
        <p class="panel security-card">
          Login Security is inactive. Activate it in Plugins to enforce IP
          blocks.
        </p>
      }
      <p class="muted">
        Your current IP:
        <strong class="ip">{{ data.currentIp || "Unavailable" }}</strong
        >. Blocking affects new sign-ins; existing sessions remain active.
      </p>
      <div class="security-grid">
        <form class="panel security-card" (ngSubmit)="save()">
          <h2>Attempt limits</h2>
          <label class="toggle"
            ><input
              type="checkbox"
              name="enabled"
              [(ngModel)]="settings.enabled"
            />Enable login protection</label
          >
          <div class="fields">
            <label
              >Attempt limit<input
                type="number"
                name="maxAttempts"
                [(ngModel)]="settings.maxAttempts"
                min="1"
                max="100"
                required
            /></label>
            <label
              >Attempt window (minutes)<input
                type="number"
                name="windowMinutes"
                [(ngModel)]="settings.windowMinutes"
                min="1"
                max="1440"
                required
            /></label>
            <label
              >Automatic block (minutes)<input
                type="number"
                name="blockMinutes"
                [(ngModel)]="settings.blockMinutes"
                min="1"
                max="10080"
                required
            /></label>
            <label
              >Activity retention (days)<input
                type="number"
                name="retentionDays"
                [(ngModel)]="settings.retentionDays"
                min="1"
                max="90"
                required
            /></label>
          </div>
          <p class="muted">
            A successful sign-in resets the IP's attempt counter. Automatic
            blocks expire after the configured duration.
          </p>
          <button class="button primary" [disabled]="busy">
            Save settings
          </button>
        </form>
        <form class="panel security-card" (ngSubmit)="block()">
          <h2>Block an IP address</h2>
          <label
            >IPv4 or IPv6 address<input
              name="ip"
              [(ngModel)]="newBlock.ip"
              placeholder="203.0.113.10"
              maxlength="64"
              required
          /></label>
          <label
            >Reason<input
              name="reason"
              [(ngModel)]="newBlock.reason"
              maxlength="300"
              placeholder="Repeated unauthorized sign-ins"
          /></label>
          <label
            >Duration (minutes)<input
              type="number"
              name="minutes"
              [(ngModel)]="newBlock.minutes"
              min="0"
              max="525600"
              required
            /><small
              >0 means permanent. Your current IP cannot be blocked from this
              session.</small
            ></label
          >
          <button class="button primary" [disabled]="busy">
            Add to block list
          </button>
        </form>
      </div>
      <section class="panel security-card section">
        <div class="section-header">
          <h2>Blocked IP addresses ({{ data.blocks.length }})</h2>
          <input
            aria-label="Filter login activity"
            [(ngModel)]="filter"
            placeholder="Filter by IP or email"
          />
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>IP address</th>
                <th>Source / reason</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              @for (row of filtered(data.blocks); track row.id) {
                <tr>
                  <td class="ip">{{ row.ip }}</td>
                  <td>
                    <span class="status">{{ row.source }}</span
                    ><br />{{ row.reason }}
                  </td>
                  <td>{{ row.created_at | date: "medium" }}</td>
                  <td>
                    {{
                      row.expires_at
                        ? (row.expires_at | date: "medium")
                        : "Permanent"
                    }}
                  </td>
                  <td>
                    <button
                      type="button"
                      class="button"
                      (click)="unblock(row.ip)"
                      [disabled]="busy"
                    >
                      Unblock & reset
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">No matching blocked IP addresses.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel security-card section">
        <h2>IP activity</h2>
        <p class="muted">
          Latest 200 attempt windows. “Attempts” shows the current counter,
          including requests awaiting authentication.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>IP address</th>
                <th>Attempts</th>
                <th>Failed</th>
                <th>Successful</th>
                <th>Last activity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              @for (row of filtered(data.windows); track row.id) {
                <tr>
                  <td class="ip">{{ row.ip }}</td>
                  <td>{{ row.attempts }}</td>
                  <td>{{ row.failures }}</td>
                  <td>{{ row.successes }}</td>
                  <td>{{ row.last_at | date: "medium" }}</td>
                  <td>
                    <button
                      type="button"
                      class="button"
                      (click)="selectIp(row.ip)"
                      [disabled]="
                        row.ip === data.currentIp || row.ip === 'unknown'
                      "
                    >
                      Choose IP to block
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">No matching sign-in activity.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel security-card section">
        <h2>Recent login attempts</h2>
        <p class="muted">
          Latest 200 events. Passwords and session tokens are never recorded.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>IP address</th>
                <th>Email submitted</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              @for (row of filtered(data.events); track row.id) {
                <tr>
                  <td>{{ row.created_at | date: "medium" }}</td>
                  <td class="ip">{{ row.ip }}</td>
                  <td>{{ row.email || "—" }}</td>
                  <td>
                    <span class="status">{{ row.outcome }}</span>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4">No matching login attempts.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
  `,
})
export class LoginSecurityComponent implements OnInit {
  api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  data: any = null;
  settings = {
    enabled: true,
    maxAttempts: 10,
    windowMinutes: 15,
    blockMinutes: 30,
    retentionDays: 7,
  };
  newBlock = { ip: "", reason: "", minutes: 0 };
  filter = "";
  error = "";
  loading = false;
  busy = false;
  ngOnInit() {
    void this.load();
  }
  filtered(rows: any[]) {
    const query = this.filter.toLowerCase().trim();
    return rows.filter(
      (row) =>
        !query ||
        row.ip.toLowerCase().includes(query) ||
        row.email?.toLowerCase().includes(query),
    );
  }
  selectIp(ip: string) {
    this.newBlock.ip = ip;
    this.api.toast(
      "IP selected. Review the reason and duration, then add it to the block list.",
    );
  }
  async load() {
    this.loading = true;
    this.error = "";
    try {
      this.data = await this.api.request("/admin/login-security");
      this.settings = { ...this.data.settings };
    } catch (error) {
      this.error = (error as Error).message;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  async action(path: string, body: unknown, message: string) {
    this.busy = true;
    this.error = "";
    try {
      await this.api.request("/admin/login-security/" + path, "POST", body);
      await this.load();
      this.api.toast(message);
      return true;
    } catch (error) {
      this.error = (error as Error).message;
      return false;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
  save() {
    void this.action(
      "settings",
      this.settings,
      "Login protection settings saved.",
    );
  }
  async block() {
    if (await this.action("block", this.newBlock, "IP address blocked."))
      this.newBlock = { ip: "", reason: "", minutes: 0 };
  }
  unblock(ip: string) {
    void this.action(
      "unblock",
      { ip },
      "IP address unblocked and attempt counter reset.",
    );
  }
}
