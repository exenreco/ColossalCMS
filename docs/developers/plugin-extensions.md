# Plugin extension registry

Colossal CMS separates plugin contributions from the server router and provides shared extension points for reviewed, bundled plugins. Package installation does not execute arbitrary uploaded JavaScript. Existing plugin manifests remain the catalog for installation, activation, menus, and lazy admin pages.

## Extension points

| Extension | Registry entry | Host responsibility |
| --- | --- | --- |
| Public HTTP endpoint | `routes` with `scope: "public"` | Match URL/method, dispatch, preserve fallback |
| Authenticated HTTP endpoint | `routes` with `scope: "admin"` | Require identity; enforce `admin: true` when declared |
| Public document override | `document(context)` | Apply response headers/status, count views, deliver HTML |
| Public head metadata | `metadata(context)` | Insert reviewed metadata into the HTML response |
| Plugin block renderer | `blockRenderers` | Resolve plugin block output before native block rendering |
| Admin dashboard widget | Admin contribution with `slot: "dashboard"` | Filter by active plugin, lazy load the Angular component |

`server/plugin-registry.mjs` implements the server contract without importing plugin implementations. `server/plugin-runtime.mjs`, `server/plugin-blocks.mjs`, and `shared/admin-extension-registry.service.ts` are composition roots: adding a reviewed contribution happens there. Core callers use the registry rather than checking a plugin ID and branching on its implementation.

## Server routes

Create a plugin-owned `plugins/<name>/server.mjs` contribution:

```js
export default {
  id: "com.example.plugin",
  routes: [{
    scope: "admin",
    path: "/api/admin/example",
    methods: ["GET"],
    admin: true,
    async handle({ request, env, db, user, path, log }) {
      return Response.json({ ok: true });
    },
  }],
};
```

A route must declare exactly one of `path` (exact match), `prefix` (exact prefix or a slash-delimited descendant), or `pattern` (reviewed regular expression source). Public contexts provide `request`, `env`, `path`, and `database()`. Authenticated contexts provide `request`, `env`, `path`, `db`, `user`, and `log(message)`. Routes run in registration order and return a `Response` or `null` to continue normal routing. Duplicate IDs, duplicate route/method ownership, and invalid declarations fail during registry creation.

The core still validates authenticated API mutations for same-origin requests and supported content types before dispatch. The registry requires a user for authenticated routes and enforces administrator-only routes before calling their handlers. Handlers validate inputs, check activation where relevant, and own business rules. Management endpoints that previously allowed configuration while a plugin was inactive retain that behavior; runtime output must explicitly respect activation. Do not broadly gate every management route on activation.

## Document and metadata hooks

Maintenance registers a document hook returning `{ rendered, status, headers, html(shell) }`. The core document handler applies the headers, calls core analytics once for the delivered document, and uses `html(shell)` to construct the response. Maintenance supplies its published layout and intentionally returns HTTP 503. Signed theme previews are validated before bypassing maintenance.

Google Ads registers its public `/ads.txt` route and verification metadata hook. SEO registers robots, sitemap, IndexNow key, settings, and submission routes. Plugin settings and activity logging now belong to those contributions. Metadata is trusted, reviewed server markup; never interpolate unvalidated user input into it.

## Plugin block rendering

Register a pure renderer in `server/plugin-blocks.mjs`:

```js
export default {
  id: "com.example.plugin",
  blockRenderers: {
    "example/banner": (settings, context, { esc }) =>
      `<aside>${esc(settings.text)}</aside>`,
  },
};
```

An unregistered type returns `undefined`, allowing native rendering to continue. A registered renderer may return an empty string to hide its block. Duplicate types and replacing `core/*` renderers are rejected. Renderers must escape user content and apply activation/preview rules. Google Ads is the first migrated renderer; its configuration and renderer are in `plugins/google-ads/` without a dependency on the theme engine. The existing `server/google-ads.mjs` exports remain compatible for callers.

## Admin UI slots

`plugins/seo/admin.ts` contributes a lazy SEO overview to the `dashboard` slot. `AdminExtensionSlotComponent` reads active plugins from admin state and renders only contributions belonging to active plugins. Dashboard code uses `<cl-admin-extension-slot slot="dashboard" />`, with no direct SEO component import. Components are cached after loading and removed from the slot when their plugin is deactivated.

## Migration status

This is the first decoupling phase. Server dispatch for Maintenance, Google Ads, SEO, Production Connections, and Login Security uses registry contributions. Maintenance document/public API overrides, AdSense verification metadata, Ads block rendering, and the Dashboard SEO widget are migrated.

Some integrations still need later migrations: the shared editor's SEO Inspector, the admin Maintenance toolbar switch, SEO columns/actions, theme render-context enrichment, authentication's login-security enforcement, and plugin-specific startup defaults. Their existing behavior is preserved. The registry does not yet expose inspector or toolbar inputs/events; define those contracts when migrating those consumers rather than inserting incomplete placeholders.

The Settings contribution (`plugins/settings/server.mjs`) registers the shared SMTP settings, verification, and test-mail routes. Mail is a core capability, rather than a transport owned by an individual plugin: trusted contributions call `sendSiteMail(env, message)` from `server/mail.mjs`. Node hosting provides `env.MAIL`; private credentials are resolved by the hosting adapter. See [Shared SMTP mail](../../README.md#shared-smtp-mail) for configuration, storage, and the sending contract.

## Verification

Run `node --test tests/plugin-registry.test.mjs` for dispatch and ownership rules. Maintenance, Google Ads, SEO, Login Security, Production Connections, and analytics integration tests cover existing behavior through the registry. Build the admin and server after adding contributions, and run dashboard/SEO and maintenance browser checks for UI slot or document changes.
