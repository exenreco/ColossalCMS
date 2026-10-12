# Advanced SEO

Advanced SEO (`com.colossal.seo`) extends the existing meta title and description controls. It is a bundled, optional plugin enabled on first registration. Administrators can deactivate it from Plugins; its saved settings remain available for reactivation.

## Workflow

**Settings → Reading → Page titles** controls the shared title layout: Page title + Site title, Site title + Page title, Page title only, or Site title only. Choose `|`, `·`, `-`, `—`, or `:` as the separator. Existing sites retain Page title · Site title until changed. An entry's meta title supplies the page-title portion; explicit social-title overrides remain independent. Search previews, title-length scoring, browser titles and default social titles use the same format.

1. Open **SEO** in the admin navigation and set the production site URL, publisher identity and default page/post schemas.
2. Open a page or post, show the right Inspector and expand **SEO**.
3. Set a focus keyword and edit the existing title/description. Review the live checklist and desktop/mobile search preview; **Expand search preview** opens a full-size modal.
4. Configure canonical URL, indexing, social overrides and schema as needed, then save or publish using the editor’s normal controls.
5. Inspect the published source or use Google’s [Rich Results Test](https://search.google.com/test/rich-results).

## Features

Mark **This post/page is pillar content** in the SEO Inspector to identify an important comprehensive resource. The designation is saved as `details.seo.pillarContent` (boolean, default false), appears as an accessible pillar icon beside the score badge in Pages/Posts, and is counted in the SEO overview. It does not inflate the score or automatically modify public structured data.

| Feature        | Behavior                                                                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Score          | Ten editorial checks, each worth 10 points. Calculated live from native block text and current metadata; no stale score is stored.                                                                                                     |
| Content tables | Pages and Posts show score and good/fair/poor classification when the plugin is active.                                                                                                                                                |
| Search preview | Approximate desktop and mobile layouts, including a larger preview modal. Search engines may rewrite snippets.                                                                                                                         |
| Indexing       | Per-entry noindex/nofollow metadata and `X-Robots-Tag` header. Search/404 routes are noindex.                                                                                                                                          |
| Canonical      | Current public URL by default; optional absolute URL override. Configured production origin prevents preview/local hosts from becoming the canonical host.                                                                             |
| Social         | Open Graph and Twitter cards; title/description inherit content metadata, image inherits the featured image.                                                                                                                           |
| Schemas        | Automatic, None, WebPage, Article, BlogPosting, AboutPage, ContactPage, ProfilePage and FAQPage. FAQ questions and answers are configured per entry and must also be visible in the content.                                           |
| Identity       | Publisher is Person or Organization; public author name is explicitly entered rather than exposing a member email.                                                                                                                     |
| Discovery      | `/sitemap.xml` includes published, indexable content and excludes drafts, future publications, noindex entries, the assigned 404 page and off-site canonical URLs. `/robots.txt` points to the sitemap and excludes admin/auth routes. |

Scores are editorial guidance, not predictions of rankings. Structured data does not guarantee rich results. FAQ settings generate metadata; they do not add visible question/answer blocks to the canvas. Use native content blocks for that content.

## Instant Index and content menus

Pages and Posts reveal Edit, Quick Edit and Delete below the title on hover or keyboard focus. Space is reserved so revealing the menu does not shift the row; touch devices show the menu directly. Quick Edit supports both content types.

When Advanced SEO is active, the menu also shows **Instant Index**. Configure **SEO → Instant indexing (IndexNow)**: set the HTTPS production site origin, generate or enter an 8–128 character verification key, enable submissions and save. The CMS serves the public key at `/{key}.txt`. Deploy before submitting; the request must originate from the configured production site.

Only published, indexable entries can be submitted. Drafts, scheduled/future content, noindex entries, the assigned 404 page and off-site canonicals are rejected. The server derives the URL from the saved entry; it never accepts arbitrary submitted URLs. Successful HTTP 200 and pending-verification HTTP 202 responses are reported separately. Provider errors and rate limits are shown without exposing raw provider responses. Submissions are logged in workspace activity. Provider tests use mocks and do not contact search engines.

IndexNow notifies participating search engines and does not guarantee crawling or indexing. This feature does not submit ordinary pages/posts through Google's restricted Indexing API. See [IndexNow documentation](https://www.indexnow.org/documentation) and [Google Indexing API scope](https://developers.google.com/search/apis/indexing-api/v3/using-api).

### Indexing endpoint

`POST /api/admin/seo/index`, authenticated admin/editor and same origin, with `{ "contentId": "saved-entry-id" }`. Returns `{ "submitted": true, "provider": "IndexNow", "status": 200, "url": "https://example.com/page", "message": "…" }` or a validation/provider error. Settings include `indexNowEnabled` (default false) and `indexNowKey` (default empty). The verification key is intentionally public proof of domain ownership, rather than a private credential.

## API and storage reference

| Endpoint             | Method   | Access             | Purpose                                                                       |
| -------------------- | -------- | ------------------ | ----------------------------------------------------------------------------- |
| `/api/admin/seo`     | GET      | Admin              | Read publisher and schema defaults.                                           |
| `/api/admin/seo`     | POST     | Admin, same origin | Validate and save defaults.                                                   |
| `/api/admin/content` | POST     | Authorized member  | Existing save endpoint; validates `details.seo` with the rest of the content. |
| `/sitemap.xml`       | GET/HEAD | Public             | XML discovery document while plugin is active.                                |
| `/robots.txt`        | GET/HEAD | Public             | Crawler directives while plugin is active.                                    |

Site defaults are stored in `config` under `seo`; per-entry settings are in `content.details.seo`. Existing `metaTitle` and `metaDescription` fields remain compatible. Data uses the configured SQLite, MongoDB or D1 provider through the existing database interface. No external analytics account or API key is required.

```json
{
  "details": {
    "metaTitle": "A useful page title",
    "metaDescription": "A useful description of the page.",
    "seo": {
      "focusKeyword": "useful page",
      "canonical": "https://example.com/useful-page",
      "noindex": false,
      "nofollow": false,
      "schemaType": "Article",
      "authorName": "Public Writer",
      "socialTitle": "",
      "socialDescription": "",
      "socialImage": "",
      "faq": []
    }
  }
}
```

Public metadata is embedded in the first HTML response and updated during frontend navigation. JSON-LD is serialized with escaped `<` characters, and URL fields reject executable schemes and embedded credentials. Signed theme previews do not emit live SEO metadata. Deactivation stops plugin output and scores while keeping the base title/description functionality and saved data.

Implementation: `shared/seo.ts`, `shared/seo-panel.component.ts`, `shared/seo-head.ts`, `server/seo.mjs`, and `projects/admin/src/plugins/seo.ts`. Verification: `tests/seo.test.mjs` and `tests/e2e/seo.cy.mjs`.
