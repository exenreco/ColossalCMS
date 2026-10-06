# Maintenance plugin

`com.colossal.maintenance` is an optional bundled plugin. Install and activate it in Plugins to expose `/admin/maintenance`. It seeds Quiet, Midnight, and Studio on first access, without changing the site's installed or active themes. Maintenance defaults to disabled.

## Editing and publishing

Maintenance reuses `ThemeEditorComponent`, its block library, Inspector, Canvas, Outline, drag-and-drop, responsive views, CSS, and history controls. Layouts can contain multiple templates. New layouts begin blank; clones copy the current draft or published document. ZIP controls and content-type assignments are omitted.

Draft saves do not affect visitors. Publishing requires a saved draft, records the previous version, and updates the published document. Restoring history creates a draft. The selected published layout cannot be deleted. Removing its selected template during publishing falls back to the layout's default template.

## Persistence and limits

The configured database stores settings and documents in the `config` record `maintenance`. Layout documents follow the existing validated theme format. No extra database tables, environment keys, filesystem templates, or ZIP packages are required.

- At most 30 layouts, with the existing editor's template and document limits.
- Up to 20 prior published versions per layout.
- Combined serialized configuration is limited to 8 MiB; database provider limits still apply.
- Configuration writes compare the previous serialized value to prevent concurrent overwrites. Settings use a global revision; individual layout writes use the layout revision. Stale writes return 409.
- Media references include published documents, drafts, and history. Only the selected published layout exposes its media publicly while maintenance is enabled.

## Request behavior

Enabled maintenance intercepts anonymous public HTML routes, including unknown URLs, with a server-rendered page and HTTP 503. Headers include `Retry-After`, `Cache-Control: no-store`, and `X-Robots-Tag: noindex`. The page renders without JavaScript; the frontend hydrates interactive blocks through the existing renderer. `/api/themes/render` returns HTTP 200 with a maintenance payload containing `status: 503`; `/api/public` returns empty public content during maintenance.

Authenticated administrators bypass maintenance. Editors and other roles do not. Login, setup, admin routes, static/media assets, health, and scheduled operations remain accessible. Valid existing signed theme previews retain their normal behavior; a fabricated token does not bypass maintenance. Maintenance previews are administrator-only and issue no public bypass token. Ad scripts are disabled on maintenance renders.

## API

All endpoints below require an administrator and an active plugin. Writes follow the application's JSON and same-origin conventions. IDs are reverse-domain layout identifiers, not site theme IDs.

| Method | Endpoint                                              | Behavior / JSON body                                          |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------- |
| GET    | `/api/maintenance`                                    | Settings, global revision, layout summaries                   |
| POST   | `/api/maintenance`                                    | Create blank layout: `{name}`                                 |
| POST   | `/api/maintenance/settings`                           | `{enabled, layoutId, templateId, retryAfter, revision}`       |
| GET    | `/api/maintenance/:id`                                | Published document, draft, layout revision, history summaries |
| DELETE | `/api/maintenance/:id`                                | Delete an unselected layout                                   |
| PUT    | `/api/maintenance/:id/draft`                          | `{document, revision}`                                        |
| POST   | `/api/maintenance/:id/publish`                        | `{revision}`                                                  |
| POST   | `/api/maintenance/:id/revert`                         | Discard draft: `{revision}`                                   |
| POST   | `/api/maintenance/:id/restore`                        | `{historyId, revision}`                                       |
| POST   | `/api/maintenance/:id/clone`                          | `{name, revision}`                                            |
| POST   | `/api/maintenance/:id/render`                         | Editor render: `{document, templateId, part}`                 |
| POST   | `/api/maintenance/:id/preview`                        | Return private preview URL: optional `{templateId}`           |
| GET    | `/api/maintenance/:id/preview?templateId=home`        | Private draft/published HTML preview                          |
| GET    | `/api/maintenance/:id/preview-render?templateId=home` | Private preview hydration payload                             |

## Verification

`tests/maintenance.test.mjs` covers starter seeding, roles, origin checks, public HTML/HEAD responses, administrator bypass, static assets, signed theme previews, draft privacy, publishing, template selection, private previews, history, cloning, deletion, concurrency, and media protection. Run `pnpm test`, `pnpm lint`, and `pnpm build` when changing integration behavior.
