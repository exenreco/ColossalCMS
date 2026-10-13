import {
  Component,
  ChangeDetectorRef,
  OnInit,
  OnDestroy,
  inject,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../../../shared/api.service";
import { assistantStream } from "../../../../plugins/ai-assistant/client";

@Component({
  selector: "cl-ai-assistant",
  standalone: true,
  imports: [FormsModule],
  styles: `
    .ai-grid {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr);
      gap: 24px;
      align-items: start;
    }
    .ai-grid .panel {
      min-width: 0;
    }
    .ai-provider-row {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
      margin: 16px 0;
    }
    .ai-provider-row select {
      flex: 1;
      min-width: 180px;
      width: auto;
    }
    .ai-provider-row .ai-enable {
      flex: 0 0 auto;
      margin: 0;
    }
    .ai-enable {
      display: flex !important;
      flex-direction: row !important;
      gap: 8px;
      align-items: center;
      margin: 16px 0;
    }
    .ai-enable input {
      width: 16px !important;
      height: 16px;
      margin: 0 !important;
      flex: 0 0 16px;
    }
    .ai-provider {
      padding: 18px 0;
      border-top: 1px solid var(--border);
    }
    .ai-provider label {
      display: flex;
      flex-direction: column;
      gap: 7px;
      margin-top: 14px;
    }
    .ai-secret {
      display: flex;
      gap: 8px;
    }
    .ai-secret input {
      min-width: 0;
      flex: 1;
    }
    .ai-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 20px;
    }
    .ai-settings .panel h2 {
      margin-top: 0;
    }
    .ai-settings .panel small {
      color: var(--muted);
    }
    .ai-settings input,
    .ai-settings select {
      width: 100%;
    }
    @media (max-width: 900px) {
      .ai-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <div class="page-heading">
      <div>
        <h1>AI Assistant</h1>
        <p>Configure the provider used by the shared editor chatbot.</p>
      </div>
      <a class="button" href="/" target="_blank" rel="noopener">Visit site ↗</a>
    </div>
    <div class="ai-settings">
      @if (error) {
        <p class="info-note" role="alert">{{ error }}</p>
      }
      @if (notice) {
        <p class="info-note" role="status">{{ notice }}</p>
      }
      @if (settings) {
        <div class="ai-grid">
          <form class="panel form-content" (ngSubmit)="save()">
            <h2>AI providers</h2>
            <div class="ai-provider-row">
              @if (settings.enabled) {
                <select
                  name="provider"
                  aria-label="AI provider"
                  [(ngModel)]="settings.provider"
                  (ngModelChange)="queryAvailableModels()"
                >
                  <option value="">-- Select Provider --</option>
                  @for (p of providers; track p.id) {
                    <option [value]="p.id">{{ p.label }}</option>
                  }
                </select>
              }
              <label class="ai-enable"
                ><input
                  type="checkbox"
                  name="enabled"
                  [(ngModel)]="settings.enabled"
                  (ngModelChange)="queryAvailableModels()"
                />Enable editor AI Assistant</label
              >
            </div>
            @if (settings.enabled && selectedProvider; as p) {
              <section class="ai-provider">
                <h3>{{ p.label }}</h3>
                @if (p.id === "custom") {
                  <label
                    >API base URL<input
                      type="url"
                      name="customBaseUrl"
                      [(ngModel)]="customBaseUrl"
                      (blur)="queryAvailableModels()"
                      [disabled]="customEndpointReadOnly"
                      placeholder="https://api.example.com/v1"
                  /></label>
                  <small
                    >OpenAI-compatible streaming Chat Completions API. We append
                    /chat/completions to this URL. Use a trusted public
                    provider.
                    @if (customEndpointReadOnly) {
                      Configure CMS_ENCRYPTION_KEY to edit here, or update the
                      environment-managed CUSTOM_AI_BASE_URL and redeploy.
                    }
                  </small>
                }
                @if (queryingModels) {
                  <p role="status">Loading available models…</p>
                }
                @if (modelQueryError) {
                  <p class="info-note" role="alert">
                    {{ modelQueryError }}
                    <button
                      type="button"
                      class="button"
                      [disabled]="queryingModels"
                      (click)="queryAvailableModels()"
                    >
                      Retry
                    </button>
                  </p>
                }
                @if (availableModels.length) {
                  <p role="status">
                    {{ availableModels.length }} models available{{
                      modelsTruncated ? " (catalog limit reached)" : ""
                    }}. Save your settings, then choose a text chat model in the
                    editor assistant.
                  </p>
                } @else if (!queryingModels && !modelQueryError) {
                  <p role="status">
                    Enter your API key to load available models automatically.
                  </p>
                }

                <label
                  >API key
                  <div class="ai-secret">
                    <input
                      [name]="p.id + 'Key'"
                      [attr.name]="p.id + 'Key'"
                      [type]="shown[p.id] ? 'text' : 'password'"
                      [(ngModel)]="keys[p.id]"
                      (blur)="queryAvailableModels()"
                      [disabled]="p.readOnly"
                      autocomplete="off"
                      [placeholder]="
                        p.configured
                          ? 'Configured — leave blank to keep'
                          : 'Enter your provider API key'
                      "
                    />
                    <button
                      class="button"
                      type="button"
                      [disabled]="p.readOnly"
                      (click)="shown[p.id] = !shown[p.id]"
                    >
                      {{ shown[p.id] ? "Hide" : "Show" }}
                    </button>
                  </div></label
                >
                <small
                  >{{ p.envKey }} ·
                  {{ p.configured ? "Configured" : "Not configured" }}.
                  @if (p.readOnly) {
                    If this key is environment-managed, update it in your
                    hosting dashboard. Otherwise configure CMS_ENCRYPTION_KEY
                    and redeploy to enable encrypted credential storage.
                  } @else {
                    Saved encrypted in the database.
                  }
                </small>
                <label
                  >Maximum output tokens<input
                    type="number"
                    name="maxOutputTokens"
                    min="512"
                    max="16384"
                    [(ngModel)]="settings.maxOutputTokens"
                /></label>
              </section>
            }
            <div class="ai-actions">
              <button class="button primary" [disabled]="busy">
                Save AI settings
              </button>
              <button
                type="button"
                class="button"
                [disabled]="busy || !settings.enabled || !settings.provider"
                (click)="test()"
              >
                Test saved provider
              </button>
            </div>
          </form>
          <aside class="panel">
            <h2>Editor workflow</h2>
            <p>
              Select a provider and configure its API key. Save your settings,
              then open AI Assistant from the editor tool rail and choose an
              available text chat model.
            </p>
            <ol>
              <li>Describe your change.</li>
              <li>Review the proposed block changes.</li>
              <li>Apply the validated batch.</li>
              <li>Undo, save or publish using the editor controls.</li>
            </ol>
            <p>
              The assistant uses the current template, shared part, post or
              page. It cannot publish or edit another document.
            </p>
            <h3>Data sent to your provider</h3>
            <p>
              Your message, current block tree and settings, block catalog,
              recent chat and media names are sent when you request a response.
              Chat is kept in memory for this editor session.
            </p>
            <p>
              API keys stay on the server. Provider requests may incur charges.
              Test verifies access to the saved provider’s model catalog without
              generating a response.
            </p>
          </aside>
        </div>
      }
    </div>
  `,
})
export class AiAssistantComponent implements OnInit, OnDestroy {
  api = inject(ApiService);
  cdr = inject(ChangeDetectorRef);
  settings: any;
  providers: any[] = [];
  keys: Record<string, string> = {};
  shown: Record<string, boolean> = {};
  customBaseUrl = "";
  customEndpointReadOnly = true;
  queryingModels = false;
  modelQueryError = "";
  availableModels: { id: string; label: string }[] = [];
  modelsTruncated = false;
  private modelQueryVersion = 0;
  busy = false;
  error = "";
  notice = "";
  controller?: AbortController;
  get selectedProvider() {
    return this.providers.find((p) => p.id === this.settings?.provider);
  }
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.controller?.abort();
    this.modelQueryVersion++;
  }
  async queryAvailableModels() {
    const version = ++this.modelQueryVersion;
    this.availableModels = [];
    this.modelQueryError = "";
    this.modelsTruncated = false;
    this.queryingModels = false;
    if (
      !this.settings?.enabled ||
      !this.selectedProvider ||
      !(
        this.keys[this.settings.provider] || this.selectedProvider.configured
      ) ||
      (this.settings.provider === "custom" && !this.customBaseUrl)
    )
      return;
    this.queryingModels = true;
    try {
      const data = await this.api.request(
        "/admin/ai-assistant/models",
        "POST",
        {
          provider: this.settings.provider,
          apiKey: this.keys[this.settings.provider] || undefined,
          customBaseUrl:
            this.settings.provider === "custom"
              ? this.customBaseUrl
              : undefined,
        },
      );
      if (version === this.modelQueryVersion) {
        this.availableModels = data.models;
        this.modelsTruncated = data.truncated;
        if (!data.models.length)
          this.modelQueryError =
            "No available models were returned by this provider.";
      }
    } catch (e) {
      if (version === this.modelQueryVersion)
        this.modelQueryError = (e as Error).message;
    } finally {
      if (version === this.modelQueryVersion) this.queryingModels = false;
      this.cdr.markForCheck();
    }
  }
  async load() {
    try {
      const data = await this.api.request("/admin/ai-assistant/settings");
      this.settings = data.settings;
      this.providers = data.providers;
      this.customBaseUrl = data.customBaseUrl || "";
      this.customEndpointReadOnly = data.customEndpointReadOnly;
      this.keys = {};
      void this.queryAvailableModels();
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.cdr.markForCheck();
    }
  }
  async save() {
    this.busy = true;
    this.error = "";
    this.notice = "";
    try {
      await this.api.request("/admin/ai-assistant/settings", "POST", {
        settings: this.settings,
        keys: this.keys,
        customBaseUrl: this.customBaseUrl,
      });
      await this.load();
      this.notice = "AI Assistant settings saved.";
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
  async test() {
    this.busy = true;
    this.error = "";
    this.notice = "";
    this.controller = new AbortController();
    try {
      await assistantStream("test", {}, this.controller.signal, (event) => {
        if (event.type === "proposal")
          this.notice = "Provider connection succeeded.";
        this.cdr.markForCheck();
      });
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
