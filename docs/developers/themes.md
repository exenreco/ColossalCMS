# Themes in Colossal 0.0.3

The **Tagline** block (`core/tagline`, Dynamic category) displays `settings.tagline` from Admin Settings. It has alignment and shared Typography/Appearance controls, no content input, and no inline canvas editing. HTML/text overrides never replace the site tagline. Empty taglines are omitted publicly and show an editor-only setup placeholder.

Themes are declarative presentation packages. Plugins provide capabilities. Uploaded JavaScript is not executed by the theme system.

## Package format

Place `theme.manifest.json` at the ZIP root. It contains a reverse-domain `id`, `name`, semver `version`, `author`, `description`, `license`, `isCore: false`, and `requires: { "colossal": ">=0.0.1" }`. Declare:

- `templates`: objects with unique kebab-case `id`, `name`, relative `file`, `appliesTo`, optional `isDefault` and `isTypeDefault`. Exactly one template must be the theme default. Each content type can have at most one type default.
- `appliesTo`: values from `home`, `page`, `post`, `post-index`, `search`, `404`.
- `parts`: an object mapping `header`, `footer`, `sidebar`, and `content` to HTML files. All four are required for v0.0.1 packages. Legacy prototype themes receive a Content part with a `core/content` block when loaded.
- `blocks`: objects with namespaced `type`, HTML `file`, and an `icon` token (for example `fas fa-heading`). Every block must declare an icon, and no two blocks in a theme may share one. The icon appears in the Block Library popover, the canvas outline and the Inspector header.
- `assets`: `{ "styles": ["assets/theme.css"], "scripts": [] }`.
- Optional `palette`: up to 12 hex colors.
- Optional `homeTemplate`: a declared template ID whose `appliesTo` includes `home`. Public rendering uses it at `/` when site routing otherwise resolves to `post-index`; content routes and separate post-index pages keep their existing resolution. The Theme Editor exposes it as **Landing page at /**.
- Optional `loading`: theme loading colors and placeholder animation. Configure these in **Theme Editor → Inspector → Theme loading appearance**. This is a theme-wide setting, saved and published with the document.

The easiest starter package is **Themes → Colossal Default → Export**. Export changes the protected core ID to an installable non-core ID. Change the ID when installing multiple copies.

Installation checks a 25 MB ZIP limit, signatures, CRCs, central-directory sizes, compression ratios, entry limits, safe paths, required files and CMS compatibility. HTML is parsed and sanitized. Scripts, frames, event handlers and executable URLs are removed. CSS is parsed, scoped under `.theme-root`, and limited to presentation properties; imports and remote resource loads are removed. The installer returns a removal summary and registers the package inactive. ZIP media is validated through the same media signature checks as library uploads.

## Block trees

Exported packages include `theme.draft.json`, the editor source of truth. It has `manifest`, `templates` (template-ID to root block), `parts` (part-name to root block), `blocks` (custom schemas), `css`, `html` and `assets`. Storage keys and compiled output are server-owned; export excludes storage keys. Plain HTML packages are converted to editable container/heading/fragment blocks. Sanitized fragments expose an HTML field; standard blocks expose structured controls.

```json
{
  "id": "blk_example",
  "type": "core/container",
  "settings": {
    "padding": { "top": 24, "right": 24, "bottom": 24, "left": 24 }
  },
  "children": [
    {
      "id": "blk_title",
      "type": "core/heading",
      "settings": { "text": "Welcome", "level": "h1" }
    }
  ]
}
```

Template and part roots must be containers. IDs are unique within each root. Nesting is limited to eight levels; the entire document is limited to 2,000 blocks. Container, Group, Row, Columns and Column accept children. `theme/part-header`, `theme/part-footer`, `theme/part-sidebar` and `theme/part-content` are shared blocks generated from the document's existing parts and listed under **Shared Parts**. They can be inserted, moved, duplicated, copied, pasted and removed, including within layout blocks. References retain their linked source; settings on each reference style its instance. Cycles between parts are rejected. Rendering gives each instance and its descendants unique IDs and preserves the source identity in `data-source-block-id`. Editing shared content opens the part's document. Columns accepts only Column children; older trees are wrapped during migration, and the column count is the number of children.

Block nodes can include optional `editor: { label: "Hero section", icon: "fas fa-star" }` metadata for the v0.0.3 Outline. Labels are plain text, limited to 80 characters; icons are Font Awesome-style tokens resolved to local SVGs, with a generic fallback for unknown tokens. Metadata changes the authoring view and does not change rendered text. Root blocks retain their semantic Body/Main identity. The [Outline API](outline-api.md) exposes live selection, tree subscriptions, commands and authenticated HTTP draft edits.

The `core/content` block renders the current page or post body, while `core/post-content` remains available for post-specific contexts. Each core block declares a unique icon and a `toolbar` array of setting keys or registered actions. The floating toolbar and Inspector write to the same block settings and undo history. Theme publishing warns when a page or post template omits the Content part, or when a changed part affects multiple templates.

The `core/container` block supports a minimum height: `minHeightEnabled`, `minHeight`, `minHeightUnit` (`px`, `vh`, `rem`), per-breakpoint overrides in `minHeightByBreakpoint`, and `verticalAlign`. Padding stays inside the min-height box (`box-sizing: border-box`), and vertical alignment centres content within the enforced height.

Core blocks include layout, Formatted HTML, headings, media, Site identity, Title, Featured image, Excerpt, menu, search, post lists, content, metadata and pagination. Dynamic blocks read current published content; custom definitions never execute code. Use the dedicated blocks for site names, titles, featured images and summaries. Legacy escaped placeholders remain readable in authored HTML for compatibility. Custom block HTML uses escaped `{{setting.fieldName}}` placeholders and optional `{{children}}`.

`core/post-list` is a container whose children define one repeating result layout. Container, Group, Row and Columns may nest Title, Featured image, Excerpt and other blocks. New lists start with Featured image, linked Title, Post metadata, Excerpt and Pagination. Each result overrides the content context, so these dynamic children read that result's data. DOM block IDs and anchors are unique for repeated instances; `data-source-block-id` maps them back to the editable layout definition. The shared Typography picker controls Title, Excerpt and Site identity text.

| Block type                        | Source and controls                                                                                                                                                                                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/site-brand` (Site identity) | Reads administrator `settings.title` and the image selected in General → Site Logo (`settings.siteLogoId`). `display` is `auto`, `logo`, `name`, or `logo-and-name`; automatic display uses the image when available, otherwise the name. Controls include `level`, `logoHeight`, `orientation`, `gap`, and `linkHome`. |
| `core/title`                      | Reads the current page/post title. Controls include heading `level`, `linkToContent` and appearance; it has no text or HTML input and ignores content overrides.                                                                                                                                                        |
| `core/featured-image`             | Reads `content.details.featuredImageId`. Controls include `showImage`, `linkToContent`, `aspectRatio`, and `objectFit`; an unrelated media override does not replace the entry's featured image. Portfolio result images retain their configured image fallback.                                                        |
| `core/excerpt`                    | Reads the saved excerpt. `showExcerpt` defaults to true; `excerptLength` is 0 for the full summary or 1–100 words, with an ellipsis when truncated. Text is escaped and empty excerpts are omitted.                                                                                                                     |
| `core/pagination`                 | Requires a Post list ancestor, directly or through layout blocks. Pagination branches render once outside repeated results, retaining their layout wrappers and using their owning list's filtered count. Search links retain the query and signed preview links retain their token.                                    |

`core/search` supplies the search form; a separate Post list supplies search results. Full-content templates do not add Excerpt automatically. The `theme-list-excerpts-v1` upgrade removes old standalone excerpt-only HTML. The idempotent `theme-context-blocks-v1` upgrade converts standalone site/title placeholders, seeds children for old flat lists with their former image/date/excerpt settings, and moves sibling Pagination into its list. Published and draft documents are recompiled and receive a new revision; authored mixed HTML, existing IDs and appearance settings are preserved. Read/import/history normalization also applies the upgrade. New invalid pagination placement is rejected by editor commands, HTTP draft saves and content validation rather than silently migrated.

## Resolution and routing

`content.templateId` resolves to an applicable explicit override, then the type default, then the theme default, then a minimal built-in renderer. Missing overrides remain stored and raise a non-blocking editor warning. Activation reports affected entries. Pages, `/year/month/slug` posts, home/custom-page post indexes, `/search?q=...`, pagination and missing-page templates share the same resolver.

## Public loading and initial HTML

Public document requests include the sanitized theme markup, CSS, body settings, title, description, favicon and active announcement in the initial HTML response. Angular reads the inert `theme-render` JSON payload and uses that exact render; it does not replace it with a journal skeleton or issue a second theme/content request during startup. This is server rendering of the declarative theme, not Angular SSR or Angular DOM hydration. Content and ordinary links also work without JavaScript.

The initial document and `/api/themes/render` use the same resolver and published-content filter. HTML requests resolve their actual URL path, search query and pagination. Missing pages return HTTP 404; maintenance remains HTTP 503 with its existing retry and noindex headers. Dynamic documents use `Cache-Control: no-store` and discard static ETags and content lengths. Signed previews validate their token before embedding a draft and remain noindex. Admin pages and static assets retain their existing serving paths.

```json
"loading": {
  "background": "#0c0d10",
  "color": "#f1f2f4",
  "accent": "#c5e5ff",
  "animation": "pulse"
}
```

| Field        | Accepted values                  | Default when omitted                     |
| ------------ | -------------------------------- | ---------------------------------------- |
| `background` | Hex color, optionally with alpha | Template root background, then `#f7f9f3` |
| `color`      | Hex color, optionally with alpha | Template root text color, then `#243e2f` |
| `accent`     | Hex color, optionally with alpha | `#246b50`                                |
| `animation`  | `glare`, `pulse`, `none`         | `glare`                                  |

These values become `--cl-loading-background`, `--cl-loading-color` and `--cl-loading-accent` on `.theme-root`. They are available to theme-authored block placeholders and CMS fallback states. Reduced motion disables placeholder animation. Existing packages can omit `loading`; no migration or custom JavaScript is required. The CMS owns readiness, retry behavior and error handling; themes supply presentation, not executable loader scripts.

Images, sliders and 3D blocks enhance independently after content is available. The full-viewport ice canvas is hidden before enhancement to avoid a portrait flash, then uses its existing first-render fade. Its static image remains available when JavaScript is disabled or live rendering fails. Public content is never held behind a full-page wait for all media.

If the provider fails inside the Worker, the CMS returns a safe HTTP 503 retry page without raw provider errors. Legacy/static shells without an initial payload retain the generic public skeleton and API fallback, bounded by a ten-second timeout and a retry action. Provider initialization failures in a hosting adapter can still occur before the Worker is reached; those retain the adapter's existing error handling.

## Drafts, publishing and preview

The database stores separate published and draft JSON documents. Saves require the latest numeric `revision`; conditional writes reject stale tabs with 409. Publishing compiles vetted HTML, increments the patch version and preserves the previous published snapshot. Restore creates a draft, without changing the live theme. Clone copies theme-owned assets into independent storage.

Preview links use HMAC-SHA256, expire after 15 minutes and bind to a specific theme revision. Changing the draft or publishing invalidates earlier links. Preview access grants media reads only for files referenced by that theme. Active published themes expose their media; draft/history references prevent deletion without making private media public.

Theme cards preview the declared landing template, then Home, then the post index. Thumbnails apply the real template body attributes and scoped CSS; they remain script-free and use image fallbacks for 3D blocks. Rendering failures show the validation message instead of an empty card.

Already-installed legacy Brilliant themes retain their `/brilliant/hero.glb` model through a bundled compatibility asset and `/brilliant/hero.svg` static fallback. Brilliant is not installed on new sites. The model URL validator accepts that exact bundled path and credential-free HTTPS URLs; arbitrary relative paths remain rejected. Rebuild the model with `node scripts/generate-brilliant-model.mjs` after changing its source geometry.

## Contributing blocks from a reviewed plugin

Register a declarative `BlockDefinition` through the shared `BlockRegistry` service during a bundled plugin's initialization:

```ts
registry.register({
  type: "example/callout",
  pluginId: "com.example.callout",
  label: "Callout",
  category: "Plugin",
  fields: [
    { key: "message", label: "Message", type: "text", default: "Hello" },
  ],
  template: '<aside class="callout">{{setting.message}}</aside>',
});
```

The editor includes registered definitions only while their plugin is active and copies the declarative definition into the saved theme for portable rendering. Field types are `text`, `textarea`, `number`, `select`, `checkbox`, `image`, and `media`; media fields open the shared picker. Templates are sanitized again on save. Uploaded plugin runtime activation remains disabled under the existing approval restriction.

See [OpenAPI](../openapi.yaml) for endpoints. Production migrations include `0002_furry_red_skull.sql`; back up the database and blob storage together before migration.

## Editor chrome (V2.0.4)

`ThemeEditorSecondaryToolbarComponent` owns two DOM regions: authoring (Blocks and View mode) and state controls (Undo, Redo, decorative divider, Responsive preview). Keep this DOM order identical to the visual order. Each radiogroup has one roving tab stop; arrows wrap and Home/End select extremes. Icon tokens resolve to local SVGs without external font requests.

`BlockLibraryDrawerComponent` hosts searchable, grouped library content and scroll persistence. `ThemeEditorComponent` owns drawer state, shared selection, shortcut dispatch, and the isolated rendering host. At 1200px and above, a 320px drawer reserves width and translates the viewport by that amount; transitions animate transform for 200ms. Smaller viewports use a scrim overlay; reduced motion disables transitions. Closed drawers are inert and hidden from accessibility APIs.

The isolated Cypress toolbar suite checks 1280/1440/1920px alignment, DOM/native Tab order, roving radio focus, keyboard shortcuts, drawer geometry, session persistence and responsive overlays. Existing drag tests cover occupied containers and persisted ordering. Add toolbar variants in Storybook when changing editor chrome.
