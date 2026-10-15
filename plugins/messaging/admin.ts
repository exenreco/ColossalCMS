import { ChangeDetectorRef, Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../shared/api.service";
import { IconComponent } from "../../shared/icon.component";
import { BulkActionsComponent } from "../../shared/bulk-actions.component";
import { AdminModalComponent } from "../../shared/admin-modal.component";
import { PluginNavigationBadges } from "../../shared/plugin-navigation-badges.service";
import { adminSections } from "../../shared/admin-sections";
import { AdminToolbarDirective } from "../../shared/admin-toolbar";
interface Field {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder: string;
  options: string[];
}
interface Settings {
  enabled: boolean;
  title: string;
  description: string;
  submitLabel: string;
  successMessage: string;
  notify: boolean;
  recipient: string;
  fields: Field[];
}
interface Message {
  id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  status: string;
  notification_status: string;
  source_path: string;
  created_at: string;
  fields: { key: string; label: string; value: string }[];
}
@Component({
  selector: "cl-messaging-admin",
  standalone: true,
  imports: [
    FormsModule,
    IconComponent,
    BulkActionsComponent,
    AdminModalComponent,
    AdminToolbarDirective,
  ],
  styles: `
    .messaging-settings {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: start;
    }
    .message-toggle {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 16px 0;
    }
    .message-toggle input {
      width: auto;
      margin: 0;
    }
    .message-field-editor {
      padding: 18px;
      border: 1px solid var(--border);
      border-radius: 12px;
      margin: 16px 0;
    }
    .message-field-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .message-field-head div {
      display: flex;
      gap: 6px;
    }
    .message-field-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .message-filters {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: start;
      margin-bottom: 20px;
    }
    .message-filters cl-bulk-actions {
      min-width: 0;
      width: 360px;
      max-width: 55%;
    }
    .message-status-filter {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      min-width: 0;
      font-size: 12px;
    }
    .message-status-filter select {
      min-width: 0;
      max-width: 160px;
      height: 36px;
      margin: 0;
      padding: 7px 10px;
    }
    .message-filters input {
      width: 320px;
      max-width: 40%;
      min-width: 0;
      height: 38px;
      margin: 0;
    }
    .message-details {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .message-details dt {
      font-size: 12px;
      color: var(--muted);
      margin-top: 18px;
    }
    .message-details dd {
      margin: 6px 0 18px;
    }
    .message-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 24px;
    }
    .message-pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 20px;
    }
    .message-unread {
      font-weight: 700;
    }
    .message-sender {
      font-size: 13px;
    }
    .message-sender small {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      color: var(--muted);
      font-weight: 400;
    }
    .message-subject {
      font: inherit;
      text-align: left;
    }
    .mail-failed {
      color: #e9987c;
    }
    .mail-sent {
      color: #56df95;
    }
    @media (max-width: 850px) {
      .messaging-settings,
      .message-field-grid {
        grid-template-columns: 1fr;
      }
      .message-filters {
        align-items: stretch;
        flex-direction: column;
      }
      .message-filters cl-bulk-actions,
      .message-filters input {
        width: 100%;
        max-width: none;
      }
    }
    @media (max-width: 700px) {
      .message-status-filter > span {
        display: none;
      }
      .message-status-filter select {
        max-width: 120px;
      }
    }
  `,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">MESSAGING</p>
        <h1>A place for every conversation.</h1>
        <p>
          Configure your message form, manage submissions and use your shared
          SMTP connection for notifications.
        </p>
      </div>
      <a class="button" href="/" target="_blank" rel="noopener">Visit site ↗</a>
    </div>
    @if (error) {
      <p class="notice" role="alert">{{ error }}</p>
    }
    @if (notice) {
      <p class="notice" role="status">{{ notice }}</p>
    }
    @if (tab === "settings") {
      <div class="messaging-settings">
        <section class="panel">
          <div class="form-content">
            <h2>Form configuration</h2>
            <label class="message-toggle admin-checkbox-row"
              ><input type="checkbox" [(ngModel)]="settings.enabled" /><span
                >Accept messages</span
              ></label
            >
            <label
              >Form title<input
                [(ngModel)]="settings.title"
                maxlength="160" /></label
            ><label
              >Introduction<textarea
                [(ngModel)]="settings.description"
                maxlength="500"
                rows="3"
              ></textarea></label
            ><label
              >Submit button label<input
                [(ngModel)]="settings.submitLabel"
                maxlength="160" /></label
            ><label
              >Confirmation message<textarea
                [(ngModel)]="settings.successMessage"
                maxlength="500"
                rows="3"
              ></textarea>
            </label>
            <h3>Email notifications</h3>
            <label class="message-toggle admin-checkbox-row"
              ><input type="checkbox" [(ngModel)]="settings.notify" /><span
                >Send notifications through SMTP</span
              ></label
            ><label
              >Notification recipient<input
                type="email"
                [(ngModel)]="settings.recipient"
                placeholder="john@example.com"
            /></label>
            <p class="field-note">
              Leave blank to use the SMTP From email. SMTP is
              {{ smtpEnabled ? "enabled" : "not enabled" }}.
              <a href="/admin/settings">Configure it in Settings → SMTP.</a>
              Messages remain in the inbox if delivery fails.
            </p>
            <button class="button primary" [disabled]="busy" (click)="save()">
              Save Messaging settings
            </button>
          </div>
        </section>
        <section class="panel">
          <div class="form-content">
            <h2>Form fields</h2>
            <p class="field-note">
              Add up to 20 fields. Reordering fields changes their order in the
              public form.
            </p>
            @for (field of settings.fields; track field.key; let i = $index) {
              <div class="message-field-editor">
                <div class="message-field-head">
                  <strong>{{ field.label || "New field" }}</strong>
                  <div>
                    <button
                      class="icon-button"
                      aria-label="Move field up"
                      [disabled]="i === 0"
                      (click)="move(i, -1)"
                    >
                      <cl-icon name="arrow-up" /></button
                    ><button
                      class="icon-button"
                      aria-label="Move field down"
                      [disabled]="i === settings.fields.length - 1"
                      (click)="move(i, 1)"
                    >
                      <cl-icon name="arrow-down" /></button
                    ><button
                      class="icon-button"
                      aria-label="Remove field"
                      [disabled]="settings.fields.length === 1"
                      (click)="settings.fields.splice(i, 1)"
                    >
                      <cl-icon name="trash" />
                    </button>
                  </div>
                </div>
                <div class="message-field-grid">
                  <label
                    >Field label<input
                      [(ngModel)]="field.label"
                      maxlength="100" /></label
                  ><label
                    >Field type<select
                      [(ngModel)]="field.type"
                      (ngModelChange)="typeChanged(field)"
                    >
                      @for (type of types; track type) {
                        <option [value]="type">{{ type }}</option>
                      }
                    </select></label
                  >
                </div>
                <label class="message-toggle admin-checkbox-row"
                  ><input type="checkbox" [(ngModel)]="field.required" /><span
                    >Required field</span
                  ></label
                >
                @if (field.type !== "checkbox") {
                  <label
                    >Placeholder<input
                      [(ngModel)]="field.placeholder"
                      maxlength="160"
                  /></label>
                }
                @if (field.type === "select") {
                  <label
                    >Choices (one per line)<textarea
                      [ngModel]="
                        field.options.join(
                          '
'
                        )
                      "
                      (ngModelChange)="optionsChanged(field, $event)"
                      rows="4"
                    ></textarea>
                  </label>
                }
              </div>
            }
            <button
              class="button"
              [disabled]="settings.fields.length >= 20"
              (click)="addField()"
            >
              Add field
            </button>
          </div>
        </section>
      </div>
    } @else {
      <ng-template clAdminToolbar>
        <label class="message-status-filter"
          ><span>Messages</span
          ><select
            aria-label="Messages"
            [(ngModel)]="status"
            (ngModelChange)="page = 1; loadMessages()"
          >
            <option value="all">All messages</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="archived">Archived</option>
            <option value="trash">Trash</option>
          </select></label
        >
      </ng-template>
      <div class="message-filters message-inbox-toolbar">
        <cl-bulk-actions
          [count]="selected.size"
          [showCount]="false"
          [clearBelow]="true"
          [busy]="busy"
          [actions]="actions"
          (applied)="bulk($event)"
          (cleared)="selected.clear()"
        />
        <input
          type="search"
          aria-label="Search messages on this page"
          [(ngModel)]="search"
          placeholder="Search this page…"
        />
      </div>
      <div class="panel admin-table-wrap">
        <table class="admin-striped-table" aria-label="Received messages">
          <thead>
            <tr>
              <th class="selection-cell">
                <input
                  type="checkbox"
                  aria-label="Select all messages on this page"
                  [checked]="allSelected"
                  (change)="selectAll($any($event.target).checked)"
                />
              </th>
              <th>From</th>
              <th>Subject</th>
              <th>Received</th>
              <th>Status</th>
              <th>Email</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (message of filtered; track message.id) {
              <tr [class.row-selected]="selected.has(message.id)">
                <td class="selection-cell">
                  <input
                    type="checkbox"
                    [attr.aria-label]="
                      'Select message from ' + message.sender_name
                    "
                    [checked]="selected.has(message.id)"
                    (change)="select(message.id, $any($event.target).checked)"
                  />
                </td>
                <td class="message-sender">
                  <strong
                    [class.message-unread]="message.status === 'unread'"
                    >{{ message.sender_name }}</strong
                  ><small>{{ message.sender_email }}</small>
                </td>
                <td>
                  <button
                    class="text-button message-subject"
                    (click)="open(message)"
                  >
                    {{ message.subject }}
                  </button>
                </td>
                <td>{{ date(message.created_at) }}</td>
                <td>
                  <span class="badge">{{ message.status }}</span>
                </td>
                <td>
                  <span
                    class="badge"
                    [class.mail-failed]="
                      message.notification_status === 'failed'
                    "
                    [class.mail-sent]="message.notification_status === 'sent'"
                    >{{ message.notification_status }}</span
                  >
                </td>
                <td>
                  <button
                    class="icon-button"
                    aria-label="View message"
                    (click)="open(message)"
                  >
                    <cl-icon name="details" />
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty-cell">
                  <p>No messages match this view.</p>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="message-pagination">
        <span>{{ total }} messages · Page {{ page }}</span>
        <div>
          <button
            class="button small"
            [disabled]="page === 1 || busy"
            (click)="page = page - 1; loadMessages()"
          >
            Previous
          </button>
          <button
            class="button small"
            [disabled]="page * 50 >= total || busy"
            (click)="page = page + 1; loadMessages()"
          >
            Next
          </button>
        </div>
      </div>
    }
    @if (current) {
      <cl-admin-modal
        [title]="current.subject"
        icon="envelope"
        [description]="current.sender_name + ' · ' + date(current.created_at)"
        (dismissed)="current = null"
        ><dl class="message-details">
          @for (field of current.fields; track field.key) {
            <dt>{{ field.label }}</dt>
            <dd>{{ field.value || "—" }}</dd>
          }
        </dl>
        @if (current.source_path) {
          <a [href]="current.source_path" target="_blank" rel="noopener"
            >Source page ↗</a
          >
        }
        <div class="message-actions">
          @if (current.sender_email) {
            <a class="button" [href]="'mailto:' + current.sender_email"
              >Reply by email</a
            >
          }
          <button class="button" (click)="itemAction('archive')">Archive</button
          ><button class="button danger" (click)="itemAction('trash')">
            Move to trash
          </button>
          @if (current.notification_status === "failed") {
            <button class="button" (click)="itemAction('retry-email')">
              Retry notification
            </button>
          }
        </div></cl-admin-modal
      >
    }
  `,
})
export class MessagingComponent implements OnInit {
  private api = inject(ApiService);
  private navigationBadges = inject(PluginNavigationBadges);
  private cdr = inject(ChangeDetectorRef);
  sectionState = adminSections(
    { inbox: "inbox", settings: "settings" },
    "inbox",
  );
  get tab() {
    return this.sectionState.value();
  }
  status = "all";
  page = 1;
  total = 0;
  search = "";
  busy = false;
  notice = "";
  error = "";
  smtpEnabled = false;
  messages: Message[] = [];
  selected = new Set<string>();
  current: Message | null = null;
  types = [
    "text",
    "email",
    "textarea",
    "tel",
    "url",
    "number",
    "select",
    "checkbox",
  ];
  settings: Settings = {
    enabled: true,
    title: "Send us a message",
    description: "",
    submitLabel: "Send message",
    successMessage: "Thank you! Your message has been received.",
    notify: true,
    recipient: "",
    fields: [],
  };
  actions = [
    { value: "read", label: "Mark as read" },
    { value: "unread", label: "Mark as unread" },
    { value: "archive", label: "Archive" },
    { value: "trash", label: "Move to trash" },
    { value: "restore", label: "Restore to inbox" },
    { value: "retry-email", label: "Retry failed email (up to 5)" },
  ];
  get filtered() {
    const q = this.search.trim().toLowerCase();
    return this.messages.filter(
      (m) =>
        !q ||
        [
          m.sender_name,
          m.sender_email,
          m.subject,
          ...m.fields.map((f) => f.value),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
    );
  }
  get allSelected() {
    return (
      this.filtered.length > 0 &&
      this.filtered.every((m) => this.selected.has(m.id))
    );
  }
  select(id: string, value: boolean) {
    if (value) this.selected.add(id);
    else this.selected.delete(id);
  }
  selectAll(value: boolean) {
    for (const m of this.filtered) this.select(m.id, value);
  }
  date(value: string) {
    return new Date(value).toLocaleString();
  }
  ngOnInit() {
    void this.load();
  }
  async load() {
    try {
      const data = await this.api.request("/admin/messaging/settings");
      this.settings = data.settings;
      this.smtpEnabled = data.smtp.enabled;
      await this.loadMessages();
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.cdr.markForCheck();
    }
  }
  async loadMessages() {
    try {
      const data = await this.api.request(
        "/admin/messaging/messages?status=" +
          encodeURIComponent(this.status) +
          "&page=" +
          this.page,
      );
      this.messages = data.messages;
      this.total = data.total;
      this.selected.clear();
      void this.navigationBadges.refresh();
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.cdr.markForCheck();
    }
  }
  addField() {
    this.settings.fields.push({
      key: "field_" + crypto.randomUUID().slice(0, 8),
      label: "New field",
      type: "text",
      required: false,
      placeholder: "",
      options: [],
    });
  }
  move(index: number, by: number) {
    const list = this.settings.fields;
    [list[index], list[index + by]] = [list[index + by], list[index]];
  }
  typeChanged(field: Field) {
    if (field.type === "select" && !field.options.length)
      field.options = ["Option 1", "Option 2"];
  }
  optionsChanged(field: Field, text: string) {
    field.options = [
      ...new Set(
        text
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ];
  }
  async save() {
    this.busy = true;
    this.error = this.notice = "";
    try {
      await this.api.request(
        "/admin/messaging/settings",
        "POST",
        this.settings,
      );
      this.notice = "Messaging settings saved.";
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
  async bulk(action: string, ids = [...this.selected]) {
    if (!ids.length) return;
    this.busy = true;
    this.error = this.notice = "";
    try {
      const result = await this.api.request("/admin/messaging/bulk", "POST", {
        action,
        ids,
      });
      this.notice = result.updated + " messages updated.";
      await this.loadMessages();
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
  open(message: Message) {
    this.current = message;
    if (message.status === "unread") {
      message.status = "read";
      void this.bulk("read", [message.id]);
    }
  }
  async itemAction(action: string) {
    if (!this.current) return;
    const id = this.current.id;
    await this.bulk(action, [id]);
    this.current = null;
  }
}
