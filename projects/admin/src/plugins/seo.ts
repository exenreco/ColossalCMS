import { SeoOverviewComponent } from "../../../../shared/seo-overview.component";
import { Component, OnInit, inject, ChangeDetectorRef } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../../../shared/api.service";
import { SCHEMA_TYPES } from "../../../../shared/seo";
@Component({
  standalone: true,
  host: { class: "admin-plugin-form" },
  imports: [FormsModule, SeoOverviewComponent],
  styles: `
    .seo-settings {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 24px;
      padding: 24px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 16px 0;
    }
    .check {
      flex-direction: row;
      align-items: center;
    }
    .check input {
      width: auto;
    }
    .settings-actions {
      padding: 0 24px 24px;
    }
    .audit {
      padding: 24px;
    }
  `,
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">ADVANCED SEO</p>
        <h1>Make your content easier to discover.</h1>
        <p>
          Configure metadata and schema defaults. Fine-tune each page or post in
          its SEO Inspector panel.
        </p>
      </div>
    </div>
    @if (error) {
      <p role="alert">{{ error }}</p>
    }
    <cl-seo-overview />
    @if (settings) {
      <section class="panel">
        <div class="seo-settings">
          <div>
            <h2>Site identity</h2>
            <label
              >Production site URL<input
                [(ngModel)]="settings.siteUrl"
                placeholder="https://example.com"
            /></label>
            <p class="field-note">
              Used for canonical and social URLs. Blank uses the current host.
            </p>
            <label
              >Publisher type<select [(ngModel)]="settings.publisherType">
                <option>Organization</option>
                <option>Person</option>
              </select></label
            ><label
              >Publisher / organization name<input
                [(ngModel)]="settings.publisherName"
                maxlength="200"
                placeholder="Use site name" /></label
            ><label
              >Publisher logo URL<input
                [(ngModel)]="settings.publisherLogo"
                placeholder="https://example.com/logo.png"
            /></label>
          </div>
          <div>
            <h2>Structured data</h2>
            <label
              >Default post schema<select
                [(ngModel)]="settings.defaultPostSchema"
              >
                @for (type of types; track type) {
                  <option>{{ type }}</option>
                }
              </select></label
            ><label
              >Default page schema<select
                [(ngModel)]="settings.defaultPageSchema"
              >
                @for (type of types; track type) {
                  <option>{{ type }}</option>
                }
              </select></label
            ><label class="check"
              ><input
                type="checkbox"
                [(ngModel)]="settings.breadcrumbs"
              />Generate breadcrumb schema</label
            >
            <p class="field-note">
              Only publish accurate information represented on the page. FAQ
              schema requires visible matching questions and answers; choose it
              per entry. Scores are editorial guidance, not ranking guarantees.
            </p>
            <a
              href="https://search.google.com/test/rich-results"
              target="_blank"
              rel="noopener"
              >Test a published URL with Google’s Rich Results Test ↗</a
            >
          </div>
        </div>
        <div class="audit">
          <h2>Instant indexing (IndexNow)</h2>
          <label class="check"
            ><input
              type="checkbox"
              [(ngModel)]="settings.indexNowEnabled"
            />Enable IndexNow submissions</label
          ><label
            >IndexNow verification key<input
              [(ngModel)]="settings.indexNowKey"
              maxlength="128"
              placeholder="Generate a verification key" /></label
          ><button
            type="button"
            class="button small"
            (click)="generateIndexKey()"
          >
            {{ settings.indexNowKey ? "Replace key" : "Generate key" }}
          </button>
          @if (settings.indexNowKey && settings.siteUrl) {
            <p class="field-note">
              Public verification file after saving:
              <a
                [href]="settings.siteUrl + '/' + settings.indexNowKey + '.txt'"
                target="_blank"
                rel="noopener"
                >{{ settings.siteUrl }}/{{ settings.indexNowKey }}.txt</a
              >
            </p>
          }
          <p class="field-note">
            Save settings, deploy to your configured HTTPS production domain,
            then hover a published page or post title and choose Instant Index.
            The CMS hosts the verification file automatically. IndexNow notifies
            participating search engines; submission does not guarantee
            indexing. Drafts, noindex content and the assigned 404 page cannot
            be submitted.
          </p>
          <a
            href="https://www.indexnow.org/documentation"
            target="_blank"
            rel="noopener"
            >IndexNow documentation ↗</a
          >
        </div>
        <div class="settings-actions">
          <button class="button primary" (click)="save()" [disabled]="busy">
            {{ busy ? "Saving…" : "Save SEO settings" }}
          </button>
        </div>
      </section>
    } `,
})
export class SeoComponent implements OnInit {
  generateIndexKey() {
    this.settings.indexNowKey = crypto.randomUUID().replaceAll("-", "");
  }
  api = inject(ApiService);
  cdr = inject(ChangeDetectorRef);
  settings: any;
  error = "";
  busy = false;
  types = SCHEMA_TYPES.filter((t) => t !== "Automatic" && t !== "FAQPage");
  async ngOnInit() {
    try {
      this.settings = await this.api.request("/admin/seo");
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
      await this.api.request("/admin/seo", "POST", this.settings);
      this.api.toast("SEO settings saved.");
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
