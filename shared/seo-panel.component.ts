import { Component, Input, Output, EventEmitter, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Content } from "./models";
import { ApiService } from "./api.service";
import { formatPageTitle } from "./page-title";
import { UiSurfaceComponent } from "./ui-surface.component";
import { analyzeSeo, SCHEMA_TYPES, SeoOptions } from "./seo";

@Component({
  selector: "cl-seo-panel",
  standalone: true,
  imports: [FormsModule, UiSurfaceComponent],
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 14px 0;
    }
    input,
    textarea,
    select {
      width: 100%;
      box-sizing: border-box;
    }
    .seo-score {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px;
      border-radius: 10px;
      background: var(--editor-field, #f0f2f2);
    }
    .seo-score strong {
      font-size: 24px;
    }
    .good {
      color: #25865e;
    }
    .fair {
      color: #b77b17;
    }
    .poor {
      color: #cf5555;
    }
    .seo-checks {
      padding: 0;
      list-style: none;
      font-size: 12px;
    }
    .seo-checks li {
      display: flex;
      gap: 8px;
      margin: 10px 0;
    }
    .seo-checks li span {
      flex: 0 0 14px;
    }
    .preview-tabs {
      display: flex;
      gap: 8px;
      margin: 12px 0;
    }
    .preview-tabs button {
      border: 1px solid var(--border, #d8dadd);
      border-radius: 6px;
      padding: 7px 10px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .preview-tabs .active {
      background: #246b5025;
    }
    .search-preview {
      border: 1px solid var(--border, #d8dadd);
      background: var(--editor-panel, #fff);
      border-radius: 12px;
      padding: 16px;
      overflow: hidden;
    }
    .search-preview.mobile {
      max-width: 320px;
    }
    .expanded-preview {
      padding: 24px;
    }
    .expanded-preview .search-preview {
      width: 600px;
      max-width: 100%;
      margin: 20px auto;
      box-sizing: border-box;
    }
    .expanded-preview .search-preview.mobile {
      width: 360px;
    }
    .expanded-preview header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .preview-url {
      font-size: 12px;
      color: var(--muted, #777);
      overflow-wrap: anywhere;
    }
    .preview-site {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .preview-site-icon {
      width: 28px;
      height: 28px;
      flex: 0 0 28px;
      object-fit: contain;
      border-radius: 6px;
    }
    .preview-title {
      color: #5278df;
      font-size: 20px;
      line-height: 1.3;
      margin: 8px 0;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
    }
    .preview-description {
      font-size: 13px;
      line-height: 1.6;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      overflow: hidden;
    }
    .check {
      flex-direction: row;
      align-items: center;
    }
    .check input {
      width: auto;
    }
    details {
      border-top: 1px solid var(--border, #d8dadd);
      margin-top: 18px;
      padding-top: 14px;
    }
    summary {
      cursor: pointer;
      font-weight: 600;
    }
    .note {
      font-size: 12px;
      color: var(--muted, #888);
      line-height: 1.6;
    }
    .faq {
      padding: 10px;
      border: 1px solid var(--border, #d8dadd);
      border-radius: 8px;
      margin: 10px 0;
    }
  `,
  template: `
    <div class="seo-score">
      <div>
        <small>SEO score</small><br /><strong [class]="analysis.level"
          >{{ analysis.score }} / 100</strong
        >
      </div>
      <span>{{ analysis.words }} words</span>
    </div>
    <p class="note">
      Editorial checks, not a ranking prediction. Search engines may rewrite
      titles and descriptions.
    </p>
    <label
      >Focus keyword<input
        [(ngModel)]="options.focusKeyword"
        maxlength="160"
        placeholder="Primary topic or phrase"
    /></label>
    <label class="check"
      ><input type="checkbox" [(ngModel)]="options.pillarContent" />This
      {{ entry.kind === "post" ? "post" : "page" }} is pillar content</label
    >
    <p class="note">
      Mark a key, comprehensive resource that related content should link to.
      This designation does not change the SEO score.
    </p>
    <label
      >URL slug<input
        [(ngModel)]="entry.slug"
        (input)="slugChange.emit()"
        maxlength="160"
    /></label>
    <label
      >Meta title
      <small>{{ previewTitle.length }} characters in generated title</small
      ><input
        [(ngModel)]="entry.details!.metaTitle"
        maxlength="200"
        [placeholder]="entry.title"
    /></label>
    <label
      >Meta description
      <small
        >{{
          (entry.details?.metaDescription || entry.excerpt).length
        }}
        characters</small
      ><textarea
        [(ngModel)]="entry.details!.metaDescription"
        rows="4"
        maxlength="500"
        [placeholder]="entry.excerpt"
      ></textarea>
    </label>
    <div class="preview-tabs" role="group" aria-label="Search preview viewport">
      <button
        type="button"
        [class.active]="viewport === 'desktop'"
        [attr.aria-pressed]="viewport === 'desktop'"
        (click)="viewport = 'desktop'"
      >
        ▱ Desktop</button
      ><button
        type="button"
        [class.active]="viewport === 'mobile'"
        [attr.aria-pressed]="viewport === 'mobile'"
        (click)="viewport = 'mobile'"
      >
        ▯ Mobile
      </button>
    </div>
    <div class="search-preview" [class.mobile]="viewport === 'mobile'">
      <div class="preview-site">
        <img class="preview-site-icon" [src]="siteIconUrl" alt="" />
        <div class="preview-url">
          {{ api.state()?.settings?.title }}<br />{{ previewUrl }}
        </div>
      </div>
      <div class="preview-title">
        {{ previewTitle }}
      </div>
      <div class="preview-description">
        {{
          entry.details?.metaDescription ||
            entry.excerpt ||
            "Add a description to preview your search snippet."
        }}
      </div>
    </div>
    <button type="button" class="button small" (click)="previewOpen = true">
      Expand search preview
    </button>
    <cl-ui-surface
      kind="modal"
      label="Search result preview"
      [open]="previewOpen"
      [width]="760"
      (dismissed)="previewOpen = false"
    >
      <div class="expanded-preview">
        <header>
          <h2>Search result preview</h2>
          <button
            type="button"
            class="button small"
            (click)="previewOpen = false"
            aria-label="Close search preview"
          >
            Close
          </button>
        </header>
        <div class="preview-tabs">
          <button
            type="button"
            [attr.aria-pressed]="viewport === 'desktop'"
            (click)="viewport = 'desktop'"
          >
            Desktop</button
          ><button
            type="button"
            [attr.aria-pressed]="viewport === 'mobile'"
            (click)="viewport = 'mobile'"
          >
            Mobile
          </button>
        </div>
        <div class="search-preview" [class.mobile]="viewport === 'mobile'">
          <div class="preview-site">
            <img class="preview-site-icon" [src]="siteIconUrl" alt="" />
            <div class="preview-url">
              {{ api.state()?.settings?.title }}<br />{{ previewUrl }}
            </div>
          </div>
          <div class="preview-title">
            {{ previewTitle }}
          </div>
          <div class="preview-description">
            {{ entry.details?.metaDescription || entry.excerpt }}
          </div>
        </div>
        <p class="note">
          Approximate {{ viewport }} layout. Actual search results depend on the
          search engine, query and device.
        </p>
      </div>
    </cl-ui-surface>
    <details open>
      <summary>Content analysis</summary>
      <ul class="seo-checks">
        @for (check of analysis.checks; track check.label) {
          <li>
            <span [class]="check.pass ? 'good' : 'poor'">{{
              check.pass ? "✓" : "○"
            }}</span
            >{{ check.label }}
          </li>
        }
      </ul>
    </details>
    <details>
      <summary>Indexing & canonical URL</summary>
      <label
        >Canonical URL<input
          [(ngModel)]="options.canonical"
          placeholder="Automatic current URL"
          maxlength="2048" /></label
      ><label class="check"
        ><input type="checkbox" [(ngModel)]="options.noindex" />Exclude from
        search indexing (noindex)</label
      ><label class="check"
        ><input type="checkbox" [(ngModel)]="options.nofollow" />Ask crawlers
        not to follow links (nofollow)</label
      >
    </details>
    <details>
      <summary>Social sharing</summary>
      <label
        >Social title<input
          [(ngModel)]="options.socialTitle"
          maxlength="200"
          placeholder="Use meta title" /></label
      ><label
        >Social description<textarea
          [(ngModel)]="options.socialDescription"
          maxlength="500"
          rows="3"
          placeholder="Use meta description"
        ></textarea></label
      ><label
        >Social image URL<input
          [(ngModel)]="options.socialImage"
          maxlength="2048"
          placeholder="Use featured image"
      /></label>
      <p class="note">
        Open Graph and Twitter card metadata use these overrides. Leave them
        empty to inherit your content metadata.
      </p>
    </details>
    <details>
      <summary>Structured data (schema)</summary>
      <label
        >Schema type<select [(ngModel)]="options.schemaType">
          @for (type of schemaTypes; track type) {
            <option>{{ type }}</option>
          }
        </select></label
      ><label
        >Schema headline / name<input
          [(ngModel)]="options.schemaName"
          maxlength="200"
          placeholder="Use content title" /></label
      ><label
        >Public author / profile name<input
          [(ngModel)]="options.authorName"
          maxlength="200"
          placeholder="Name to publish in structured data"
      /></label>
      @if (options.schemaType === "FAQPage") {
        <p class="note">
          Only add questions and answers also visible on this page.
        </p>
        @for (item of options.faq; track $index) {
          <div class="faq">
            <label
              >Question<input
                [(ngModel)]="item.question"
                maxlength="500" /></label
            ><label
              >Answer<textarea
                [(ngModel)]="item.answer"
                rows="3"
                maxlength="5000"
              ></textarea></label
            ><button
              type="button"
              class="button small"
              (click)="options.faq!.splice($index, 1)"
            >
              Remove question
            </button>
          </div>
        }
        <button
          type="button"
          class="button small"
          [disabled]="(options.faq?.length || 0) >= 30"
          (click)="addFaq()"
        >
          Add question
        </button>
      }
      <p class="note">
        Automatic uses the plugin’s page/post default. Structured data does not
        guarantee rich results.
      </p>
    </details>
  `,
})
export class SeoPanelComponent {
  get previewTitle() {
    return formatPageTitle(
      this.entry.details?.metaTitle || this.entry.title || "Page title",
      this.api.state()?.settings,
    );
  }
  get siteIconUrl() {
    const id = this.api.state()?.settings.siteIconId;
    return id
      ? "/api/media/" + encodeURIComponent(id) + "/file"
      : "/favicon.svg";
  }
  @Input({ required: true }) entry!: Content;
  @Output() slugChange = new EventEmitter<void>();
  api = inject(ApiService);
  schemaTypes = SCHEMA_TYPES;
  viewport = "desktop";
  previewOpen = false;
  get options(): SeoOptions {
    this.entry.details ??= {};
    return (this.entry.details.seo ??= { schemaType: "Automatic", faq: [] });
  }
  get analysis() {
    return analyzeSeo(this.entry, this.api.state()?.settings);
  }
  get previewUrl() {
    if (this.options.canonical) return this.options.canonical;
    if (this.api.state()?.settings.homePageId === this.entry.id)
      return location.origin + "/";
    const date = new Date(this.entry.publishAt || Date.now());
    const path =
      this.entry.kind === "post"
        ? `/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${this.entry.slug}`
        : "/" + this.entry.slug;
    return location.origin + path;
  }
  addFaq() {
    (this.options.faq ??= []).push({ question: "", answer: "" });
  }
}
