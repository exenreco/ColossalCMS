import { ChangeDetectorRef, Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { ApiService } from "../../../../shared/api.service";

@Component({
  selector: "cl-google-ads",
  standalone: true,
  imports: [FormsModule, RouterLink],
  styles: `
    .verification-preview {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      padding: 12px;
      background: var(--canvas, #f5f6f7);
      border-radius: 8px;
      font-size: 12px;
    }
    .form-content label.live-ads-toggle {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
    }
    .form-content .live-ads-toggle input {
      width: auto;
      margin: 0;
    }
    .settings-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 20px;
    }
  `,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">GOOGLE ADSENSE</p>
        <h1>Ads that fit your site.</h1>
        <p>
          Connect your AdSense display ad unit, then add an Ads block in any
          editor.
        </p>
      </div>
    </div>
    @if (!enabled) {
      <section class="panel empty-cell">
        <h2>Activate Google Ads to add ad blocks</h2>
        <a class="button primary" routerLink="/admin/plugins">Manage plugins</a>
      </section>
    } @else {
      <form class="panel settings-panel" (ngSubmit)="save()">
        <div class="form-content">
          <h2>AdSense connection</h2>
          <p>
            Copy these values from the display ad code in your AdSense account.
          </p>
          <label
            >Publisher ID<input
              name="publisherId"
              [(ngModel)]="settings.publisherId"
              placeholder="ca-pub-1234567890123456"
              maxlength="23"
            /><small>Both pub- and ca-pub- formats are accepted.</small></label
          >
          <label
            >Default ad slot ID<input
              name="slotId"
              [(ngModel)]="settings.slotId"
              placeholder="1234567890"
              inputmode="numeric"
              maxlength="20"
            /><small>Each Ads block can override this slot.</small></label
          >
          <h2>Site verification</h2>
          <label class="live-ads-toggle">
            <input
              name="verificationMeta"
              type="checkbox"
              [(ngModel)]="settings.verificationMeta"
            />
            Publish AdSense verification metadata
          </label>
          <small
            >The meta tag uses the Publisher ID above. No ad slot or live ads
            are required.</small
          >
          @if (settings.verificationMeta && normalizedPublisher) {
            <pre
              class="verification-preview"
            ><code>{{ metadataPreview }}</code></pre>
          }
          <label class="live-ads-toggle">
            <input
              name="adsTxtEnabled"
              type="checkbox"
              [(ngModel)]="settings.adsTxtEnabled"
            />
            Publish /ads.txt
          </label>
          @if (settings.adsTxtEnabled) {
            <label
              >Custom ads.txt content (optional)
              <textarea
                name="adsTxtContent"
                [(ngModel)]="settings.adsTxtContent"
                rows="6"
                maxlength="20000"
                placeholder="Leave blank to generate the Google entry from your Publisher ID"
              ></textarea>
              <small
                >Custom content replaces the generated file. Include the exact
                publisher entry supplied by Google. Plain text only; comments
                and additional advertising partners are supported.</small
              >
            </label>
            <p class="field-note">ads.txt preview (save to publish)</p>
            <pre
              class="verification-preview"
            ><code>{{ adsTxtPreview }}</code></pre>
          }
          <p class="field-note">
            Save these settings to publish changes. Disabling ads.txt makes its
            URL return 404; disabling metadata removes the verification tag. In
            AdSense Sites, add your domain and choose the meta tag or ads.txt
            verification method, then request review. An ad slot is only needed
            to enable live display ads. This plugin does not connect Google Ad
            Manager or manage Google Ads campaigns.
            <a href="/ads.txt" target="_blank" rel="noopener">View ads.txt</a>
          </p>
          <label
            >Default format<select name="format" [(ngModel)]="settings.format">
              <option value="auto">Automatic</option>
              <option value="horizontal">Horizontal</option>
              <option value="rectangle">Rectangle</option>
              <option value="vertical">Vertical</option>
            </select></label
          >
          <label
            >Sizing<select name="sizing" [(ngModel)]="settings.sizing">
              <option value="responsive">Responsive</option>
              <option value="fixed">Fixed dimensions</option>
            </select></label
          >
          @if (settings.sizing === "fixed") {
            <label
              >Width (px)<input
                name="width"
                type="number"
                [(ngModel)]="settings.width"
                min="50"
                max="2000"
            /></label>
            <label
              >Height (px)<input
                name="height"
                type="number"
                [(ngModel)]="settings.height"
                min="50"
                max="2000"
            /></label>
          }
          <label class="live-ads-toggle"
            ><input
              name="liveAds"
              type="checkbox"
              [(ngModel)]="settings.liveAds"
            />
            Enable live ads on public pages</label
          >
          <p class="field-note">
            When disabled, public pages show a preview placeholder. Editor
            canvases and theme previews always use placeholders. Google
            determines ad availability for your account and site. Browser ad
            blockers can prevent Google's script from loading; test with
            blocking disabled for your site.
          </p>
          <div class="settings-actions">
            <a
              href="https://support.google.com/adsense/answer/9183363"
              target="_blank"
              rel="noopener noreferrer"
              >Find your publisher and ad slot IDs ↗</a
            >
            @if (error) {
              <p class="error" role="alert">{{ error }}</p>
            }
            <button class="button primary" [disabled]="busy || loading">
              {{ busy ? "Saving…" : "Save Google Ads settings" }}
            </button>
          </div>
        </div>
      </form>
    }
  `,
})
export class GoogleAdsComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  api = inject(ApiService);
  settings = {
    publisherId: "",
    slotId: "",
    format: "auto",
    sizing: "responsive",
    width: 300,
    height: 250,
    liveAds: false,
    verificationMeta: true,
    adsTxtEnabled: true,
    adsTxtContent: "",
  };
  loading = true;
  busy = false;
  error = "";
  get normalizedPublisher() {
    const value = this.settings.publisherId.trim().replace(/^pub-/, "ca-pub-");
    return /^ca-pub-\d{16}$/.test(value) ? value : "";
  }
  get metadataPreview() {
    return `<meta name="google-adsense-account" content="${this.normalizedPublisher}">`;
  }
  get adsTxtPreview() {
    if (!this.normalizedPublisher)
      return "Enter a valid Publisher ID to publish ads.txt.";
    return (
      this.settings.adsTxtContent.trim() ||
      `google.com, ${this.normalizedPublisher.slice(3)}, DIRECT, f08c47fec0942fa0`
    );
  }
  get enabled() {
    return (
      this.api.state()?.user.role === "admin" &&
      this.api
        .state()
        ?.plugins.some((p) => p.id === "com.colossal.google-ads" && p.active)
    );
  }
  async ngOnInit() {
    try {
      this.settings = await this.api.request("/admin/google-ads");
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
    try {
      await this.api.mutate(
        "/admin/google-ads",
        "POST",
        this.settings,
        "Google Ads settings saved.",
      );
      this.settings = await this.api.request("/admin/google-ads");
    } catch (error) {
      this.error = (error as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
