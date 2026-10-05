# Architecture

The implementation follows the dual-application and plugin model in `Colossal CMS - V2.pdf` (version 2.0, Exenreco Bell).

`projects/admin` and `projects/frontend` are independent Angular bootstrap applications. Angular CLI builds each separately. `scripts/build-server.mjs` assembles the static bundles and bundles the Worker API.

## Request flow

1. A trusted hosting gateway authenticates administrators.
2. The Worker serves the admin SPA at `/admin/*` and public SPA elsewhere.
3. The admin shell loads the authenticated session and server state through `ApiService`.
4. The router derives routes from JSON manifests and an allowlisted lazy-component map. Guards check plugin activation and role; the Worker independently authorizes every operation.
5. The public app loads `/api/public` to obtain settings, activated plugins, and publishable content. Drafts are excluded on the server. Validated rich-text nodes are rendered with Angular sanitization; media uses stable IDs.

## Persistence

D1 and SQLite share prepared-statement operations. Node production hosting also supports MongoDB through a native operation adapter. The schema lives in `db/schema.ts`; `drizzle/` contains versioned migrations. Node production startup applies D1 migrations or ensures MongoDB collections, validators and indexes before accepting requests. Application initialization seeds a small sample set in an atomic batch, separately from schema migrations. Native Worker deployments apply migrations with deployment tooling. See [Production Connections](developers/production-connections.md).

The tables are content, plugins, config, members, activity, api_keys, media, revisions, plugin_packages, plugin_versions and notices. Content details store rich text and panel metadata. Uploaded files use an R2-compatible STORAGE binding or the local filesystem adapter. URL slugs and member emails have unique indexes. Writes update durable records before the client refreshes state. API keys are random, SHA-256 hashed at rest, and displayed once.

## Publishing

Published records are public immediately. A scheduled record is public when `publish_at <= now`, evaluated at request time. The site does not cache API responses. Post URLs use the stored publication timestamp in UTC. A future scheduled record can be edited without exposing it publicly.

## Authorization

Administrators manage all surfaces; editors create and manage content and media. The owner is immutable through the membership UI. Core plugin protection is enforced server-side, not only through disabled controls. Same-origin checks protect mutations; uploads accept bounded multipart requests and other writes require JSON. Unreferenced and unpublished media require a CMS session. Uploaded plugin activation is disabled pending approval of its trusted execution model.

The local Node server binds only to 127.0.0.1 and uses token-protected administrator setup and password sessions by default. Automatic developer identity is available only with the explicit CMS_DEV_AUTH_BYPASS flag. Node production hosting uses HTTPS password sessions, strips incoming identity headers, and supports first-run setup via CMS_SETUP_TOKEN. The Cloudflare Worker adapter requires a trusted gateway that overwrites identity headers; its owner setup relies on private owner-only platform access.

The Node production adapter removes incoming identity headers and verifies persistent password sessions before forwarding identity to the Worker API. Passwords use bcrypt cost 12; session tokens are SHA-256 hashed in storage and expire after eight hours. Production connections are kept in server dotenv or hosting environment variables, with admin-only reveal/edit endpoints and sanitized operation logs.

## Development workflow

Feature branches target `develop`; tested releases target `main`. The checked-in GitHub Actions workflow runs formatting, TypeScript, API integration tests, dependency audit, both production builds, isolated Cypress flows and Storybook builds, and uploads a versioned artifact. Deployment environments and production approval gates must be configured for the eventual hosting account. Do not treat an artifact upload as a deployment.

## V2.0.2 themes and loading states

The locked Themes plugin lives in the System menu group. `server/theme-engine.mjs` validates declarative trees and compiles sanitized templates; `server/themes.mjs` owns installation, versioned persistence, activation, export, assets and signed previews. `ThemeEditorState` coordinates the nested outline and inspector with a bounded undo journal. The public Angular app renders server-sanitized theme output and retains a built-in fallback. See [Theme architecture and API](developers/themes.md).

v2.0.2 adds three refinements on top of that foundation:

- **Unique block icons.** Every block declares an `icon` token. The manifest validator requires an icon and rejects duplicate icons within a theme; the library popover, canvas outline and Inspector header render the same icon. `BlockIconComponent` resolves the token to inline SVG.
- **Container min height.** `core/container` gains `minHeightEnabled`, `minHeight`, `minHeightUnit`, per-breakpoint overrides and `verticalAlign`. `minHeightCss` compiles these into breakpoint-aware rules keyed by the block's stable id, and `renderTheme` emits them alongside the theme CSS.
- **True-frontend canvas and skeleton screens.** The Theme Editor canvas consumes the same render endpoint as the Frontend and layers editor affordances over the true render inside an isolated `allow-same-origin` iframe. `cl-skeleton` and its composition library provide glare-animated, reduced-motion-aware loading states for both applications; plugins declare their skeletons in `plugin.manifest.json`.
