# Colossal CMS

**Version 0.0.1** — A block-based CMS with separate Angular administration and public applications, a shared HTTP API, declarative themes, and bundled extensions.

Manage posts, pages, media, site settings, templates, and team access. Local development uses SQLite and local files. Node production supports MongoDB or Cloudflare D1 records with MongoDB GridFS, R2-compatible object storage, or persistent local files. Production defaults to **MongoDB + GridFS**.

All application files live at the **repository root**. Run commands in the directory containing `package.json`; there is no `app/` directory.

## Contents

- [Contents](#contents)
  - [Install and start](#install-and-start)
  - [First administrator](#first-administrator)
- [Command reference](#command-reference)
  - [Application commands](#application-commands)
  - [Checks and previews](#checks-and-previews)
- [Architecture and project structure](#architecture-and-project-structure)
  - [Request flow](#request-flow)
  - [Data model](#data-model)
- [Administration and publishing](#administration-and-publishing)
  - [Content workflow](#content-workflow)
  - [Routing](#routing)
- [Block editors](#block-editors)
  - [Blocks and layout](#blocks-and-layout)
  - [Appearance controls](#appearance-controls)
  - [HTML mode](#html-mode)
  - [Shortcuts](#shortcuts)
- [Themes and templates](#themes-and-templates)
  - [Authoring workflow](#authoring-workflow)
  - [Packaging](#packaging)
- [Previews and Storybook](#previews-and-storybook)
- [Media management](#media-management)
- [Plugins and extensions](#plugins-and-extensions)
  - [Maintenance](#maintenance)
  - [Google Ads](#google-ads)
  - [Plugin packages and development](#plugin-packages-and-development)
- [Authentication and authorization](#authentication-and-authorization)
  - [Runtime identity boundary](#runtime-identity-boundary)
- [Databases, storage, and migration](#databases-storage-and-migration)
  - [Connections workflow](#connections-workflow)
  - [Optional local migration](#optional-local-migration)
- [Environment configuration](#environment-configuration)
- [API reference](#api-reference)
  - [Request conventions](#request-conventions)
  - [Public and authentication endpoints](#public-and-authentication-endpoints)
  - [Workspace and content](#workspace-and-content)
  - [Media](#media)
  - [Themes](#themes)
  - [Plugins and connections](#plugins-and-connections)
  - [Examples](#examples)
- [Deployment](#deployment)
  - [Node / Render](#node--render)
  - [Native Worker](#native-worker)
  - [Backups and operations](#backups-and-operations)
- [Development and release workflows](#development-and-release-workflows)
  - [Typical change](#typical-change)
  - [CI](#ci)
  - [Release maintenance](#release-maintenance)
- [Troubleshooting](#troubleshooting)
  - [Documentation index](#documentation-index)

<table>
    <caption>Requirements and quick start</caption>
    <thead>
        <tr>
            <th>Requirement</th>
            <th>Version / purpose</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Node.js</td>
            <td>24.x; supplies the local SQLite runtime</td>
        </tr>
        <tr>
            <td>pnpm</td>
            <td>11.19.0, pinned in `packageManager`</td>
        </tr>
        <tr>
            <td>Browser</td>
            <td>Modern browser; WebGL for interactive 3D models</td>
        </tr>
        <tr>
            <td>Production services</td>
            <td>Configured database and storage; not required locally</td>
        </tr>
    </tbody>
</table>

### Install and start

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm dev
```

<table>
    <caption>Local Addresses</caption>
    <thead>
        <tr>
            <th>Local address</th>
            <th>Purpose</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>`http://127.0.0.1:4200/`</td>
            <td>Public website</td>
        </tr>
        <tr>
            <td>`http://127.0.0.1:4200/admin/`</td>
            <td>Administration</td>
        </tr>
        <tr>
            <td>`http://127.0.0.1:4200/setup`</td>
            <td>First administrator setup</td>
        </tr>
        <tr>
            <td>`http://127.0.0.1:4200/login`</td>
            <td>Password sign-in</td>
        </tr>
    </tbody>
</table>

The development server binds to loopback and serves compiled files from `dist/client/`. It is **not an Angular hot-reload server**. Rebuild after frontend edits and restart the Node process after server edits. Stop an interactive server with **Ctrl+C**.

### First administrator

1. Open `/admin/`; a new installation redirects to `/setup`.
2. Read the generated token from `.local/setup-token`. The console prints its path, not its value.
3. Enter the token, owner email, password, and confirmation.
4. Sign in at `/login`.

There is no shared default root password. Passwords require at least 12 characters and at most 72 UTF-8 bytes. Setup closes once owner credentials exist, including after restart. A setup token cannot reset an existing account.

<table>
    <caption>Local Paths</caption>
    <thead>
        <tr>
            <th>Local path</th>
            <th>Contents</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>`.local/colossal.sqlite`</td>
            <td>Records, themes, revisions, credentials, and sessions</td>
        </tr>
        <tr>
            <td>`.local/storage/`</td>
            <td>Uploads and installed package assets</td>
        </tr>
        <tr>
            <td>`.local/setup-token`</td>
            <td>Generated first-run token when needed</td>
        </tr>
        <tr>
            <td>`.env.production`</td>
            <td>Optional production configuration, not development records</td>
        </tr>
    </tbody>
</table>

Normal builds and restarts preserve local data. Private/generated paths are ignored by Git; `.env.example` is the committed configuration template.

## Command reference

### Application commands

<table>
    <caption>Application commands</caption>
    <thead>
        <tr>
            <th>Command</th>
            <th>Behavior</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>`pnpm install --frozen-lockfile`</td>
            <td>Install dependencies without changing the lockfile</td>
        </tr>
        <tr>
            <td>`pnpm build`</td>
            <td>Build admin, build frontend, then assemble assets and bundle the Worker API</td>
        </tr>
        <tr>
            <td>`pnpm build:admin`</td>
            <td>Build administration into `dist/admin/`</td>
        </tr>
        <tr>
            <td>`pnpm build:frontend`</td>
            <td>Build the public application into `dist/frontend/`</td>
        </tr>
        <tr>
            <td>`pnpm build:server`</td>
            <td>Recreate `dist/client/` from both Angular builds and bundle `dist/server/index.js`</td>
        </tr>
        <tr>
            <td>`pnpm dev`</td>
            <td>Start the local SQLite/file server, normally on port 4200</td>
        </tr>
        <tr>
            <td>`pnpm dev:local`</td>
            <td>Alias for the local server</td>
        </tr>
        <tr>
            <td>`pnpm start`</td>
            <td>Start Node production with configured providers</td>
        </tr>
        <tr>
            <td>`pnpm db:generate`</td>
            <td>Generate Drizzle SQL migrations from `db/schema.ts`; does not apply them</td>
        </tr>
        <tr>
            <td>`pnpm password:hash`</td>
            <td>Read a password privately in an interactive terminal and print its bcrypt cost-12 hash</td>
        </tr>
    </tbody>
</table>

`build:server` requires both Angular outputs. Run it after either partial application build to refresh served files. Node production imports runtime sources through `scripts/production-server.mjs`: retain source modules and dependencies alongside `dist/client/`. The Worker bundle alone is not a complete Node deployment.

### Checks and previews

<table>
    <caption>Checks and previews</caption>
    <thead>
        <tr>
            <th>Command</th>
            <th>Behavior</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>`pnpm lint`</td>
            <td>TypeScript checks without emitting files</td>
        </tr>
        <tr>
            <td>`pnpm test`</td>
            <td>Node integration tests in `tests/*.test.mjs`</td>
        </tr>
        <tr>
            <td>`pnpm format:check`</td>
            <td>Check source, scripts, tests, docs, and README formatting</td>
        </tr>
        <tr>
            <td>`pnpm format`</td>
            <td>Format those files in place</td>
        </tr>
        <tr>
            <td>`pnpm audit`</td>
            <td>Dependency audit with a high-severity threshold</td>
        </tr>
        <tr>
            <td>`pnpm exec cypress install`</td>
            <td>Install the Cypress binary needed for browser tests</td>
        </tr>
        <tr>
            <td>`pnpm e2e`</td>
            <td>Start an isolated server on port 4201 and run headless Electron workflows</td>
        </tr>
        <tr>
            <td>`pnpm storybook`</td>
            <td>Component preview server on port 6006</td>
        </tr>
        <tr>
            <td>`pnpm storybook:build`</td>
            <td>Static component showcase in `storybook-static/`</td>
        </tr>
    </tbody>
</table>

Build before E2E. Its runner generates ZIP fixtures, uses temporary SQLite data and explicit local authentication bypass, stops its server afterward, and prints the retained data directory. It does not reuse your `.local` installation. Select an existing spec using `CMS_E2E_SPEC`, for example in PowerShell:

```powershell
$env:CMS_E2E_SPEC = 'tests/e2e/themes.cy.mjs'
pnpm e2e
Remove-Item Env:CMS_E2E_SPEC
```

Choose a path that exists in `tests/e2e/`. pnpm warns about dependency drift before scripts; installs are explicit. Run the frozen install when dependencies need repair.

## Architecture and project structure

<table>
    <caption>Architecture and project structure</caption>
    <thead>
        <tr>
            <th>Path</th>
            <th>Responsibility</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>`projects/admin/`</td>
            <td>Angular admin shell, routes, and plugin screens</td>
        </tr>
        <tr>
            <td>`projects/frontend/`</td>
            <td>Public Angular application and rendering hosts</td>
        </tr>
        <tr>
            <td>`shared/`</td>
            <td>Editors, blocks, models, API services, media tools, runtime hosts</td>
        </tr>
        <tr>
            <td>`shared/theme-blocks.json`</td>
            <td>Declarative block catalog and Inspector definitions</td>
        </tr>
        <tr>
            <td>`shared/pickers/`</td>
            <td>Reusable appearance and slide-background popovers</td>
        </tr>
        <tr>
            <td>`server/worker.mjs`</td>
            <td>Shared API and server authorization boundary</td>
        </tr>
        <tr>
            <td>`server/theme-engine.mjs`</td>
            <td>Block validation and safe HTML/CSS rendering</td>
        </tr>
        <tr>
            <td>`server/themes.mjs`</td>
            <td>Installation, drafts, publishing, activation, history, previews</td>
        </tr>
        <tr>
            <td>`server/media.mjs`</td>
            <td>Upload validation, metadata, file access, references</td>
        </tr>
        <tr>
            <td>`scripts/`</td>
            <td>Node hosting, authentication, provider adapters, migration, build/test tools</td>
        </tr>
        <tr>
            <td>`plugins/`</td>
            <td>Bundled manifests and registry</td>
        </tr>
        <tr>
            <td>`db/schema.ts`</td>
            <td>Type-safe database schema and query builders</td>
        </tr>
        <tr>
            <td>`publlic/`<td>
            <td>Static assets copied into builds</td>
        </tr>
        <tr>
            <td>`stories/`, `.storybook/`</td>
            <td>Isolated component examples and configuration</td>
        </tr>
        <tr>
            <td>`tests/`</td>
            <td>Unit and E2E tests</td>
        </tr>
        <tr>
            <td>`docs/`</td>
            <td>Developer documentation and API references</td>
        </tr>
        <tr>
            <td>`render.yaml`</td>
            <td>Node service Blueprint</td>
        </tr>
        <tr>
            <td>`.github/workflows/ci.yml`</td>
            <td>Validation and build artifacts</td>
        </tr>
    </tbody>
</table>                                          |

### Request flow

1. The Node adapter handles setup/login, verifies session cookies, and redirects signed-out administration requests.
2. Verified identity is passed internally to the shared API. Browser-supplied identity headers are removed by Node.
3. The admin app loads its session and workspace state. Plugin manifests determine menus; the server independently authorizes requests.
4. The public app requests public configuration and a theme render for its route.
5. The theme engine resolves the applicable template, shared parts, and current content, then returns sanitized output.
6. Reviewed runtime hosts initialize Swiper, glTF, and permitted live AdSense features.
7. Database adapters persist records; storage adapters persist binary files separately.

Publishing changes persistent data and does not require rebuilding Angular. Scheduled publication is evaluated at request time; no background publishing cron is required.

### Data model

Record stores include `content`, `config`, `members`, `plugins`, `activity`, `api_keys`, `media`, `revisions`, `plugin_packages`, `plugin_versions`, `notices`, `themes`, `theme_history`, `auth_credentials`, and `auth_sessions`.

Content blocks live in `details.contentBlocks`, Main settings in `details.contentMain`, and supplemental rich-text data in `details.richText`. `body` retains a text representation for integrations and older records. Media references use stable IDs. Themes retain separate draft/published documents and history. Passwords, sessions, and API keys persist as appropriate hashes rather than plaintext secrets.

## Administration and publishing

<table>
    <caption>Administration screens</caption>
    <thead>
        <tr>
            <th>Screen</th>
            <th>Route</th>
            <th>Purpose</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Dashboard</td>
            <td>`/admin/dashboard`</td>
            <td>Activity and notices</td>
        </tr>
        <tr>
            <td>Pages</td>
            <td>`/admin/pages`</td>
            <td>Create and manage pages</td>
        </tr>
        <tr>
            <td>Posts</td>
            <td>`/admin/posts`</td>
            <td>Create and manage posts</td>
        </tr>
        <tr>
            <td>Media</td>
            <td>`/admin/media`</td>
            <td>Library, uploads, selection, replacement</td>
        </tr>
        <tr>
            <td>Settings</td>
            <td>`/admin/settings`</td>
            <td>Site identity, routing, members, read keys</td>
        </tr>
        <tr>
            <td>Themes</td>
            <td>`/admin/themes`</td>
            <td>Design, preview, publish, activate</td>
        </tr>
        <tr>
            <td>Plugins</td>
            <td>`/admin/plugins`</td>
            <td>Bundled extensions and staged packages</td>
        </tr>
        <tr>
            <td>Connections</td>
            <td>`/admin/connections`</td>
            <td>Providers and member passwords; requires active extension</td>
        </tr>
        <tr>
            <td>Google Ads</td>
            <td>`/admin/google-ads`</td>
            <td>AdSense defaults; requires active extension</td>
        </tr>
    </tbody>
</table>

Create at `/admin/posts/new` or `/admin/pages/new`. Edit at `/admin/posts/edit/:id` or `/admin/pages/edit/:id`. Theme editing uses `/admin/themes/edit/:id`.

### Content workflow

1. Create a post/page, set its title and unique slug, and build its block layout.
2. Configure the right panel: excerpt, status, publication date, featured image, author, categories/tags, SEO, applicable template, and revisions.
3. Review Canvas at desktop, tablet, and mobile widths.
4. Save a draft, mark pending review, publish, or schedule a future date.

<table>
    <caption>Content workflow</caption>
    <thead>
        <tr>
            <th>State/action</th>
            <th>Public effect</th>
        </tr>
    </thead>
    <tbody>
        <tr><td>Draft</td><td>Private</td></tr>
        <tr><td>Pending</td><td>Private work awaiting review</td></tr>
        <tr><td>Published</td><td>Visible immediately</td></tr>
        <tr><td>Scheduled</td><td>Visible when its future timestamp becomes due</td></tr>
        <tr><td>Published-entry autosave</td><td>Private revision; live entry stays unchanged</td></tr>
        <tr><td>Explicit Save draft on published content</td><td>Unpublishes the entry</td></tr>
        <tr><td>Restore revision</td><td>Loads editor state; save/publish to apply it</td></tr>
    </tbody>
</table>

Dirty content autosaves every 60 seconds. Manual updates use `expectedUpdatedAt` to reject stale changes. Leaving with unsaved work prompts for confirmation. Deleting content removes its revisions and repairs assigned page roles.

### Routing

<table>
    <caption>Route Resolution</caption>
    <thead>
        <tr>
            <th>Route</th>
            <th>Resolution</th>
        </tr>
    </thead>
    <tbody>
        <tr><td>/</td><td>Assigned Home page or posts index</td></tr>
        <tr><td>/:slug</td><td>Published page</td></tr>
        <tr><td>/:year/:month/:slug</td><td>Published post, using publication date in UTC</td></tr>
        <tr><td>/search?q=term</td><td>Search template and public results</td></tr>
        <tr><td>Assigned Posts page URL</td><td>Separate post index when configured</td></tr>
        <tr><td>Unmatched URL</td><td>404 template, using assigned 404 page content when present</td></tr>
    </tbody>
</table>

In **Settings → General → Pages & Routing**, choose published Home, Posts, and 404 pages. A page can have one role. The 404 page is excluded from normal navigation and ordinary page routing. Unpublishing/deleting assigned pages clears the role and creates a notice.

## Block editors

Theme, page, and post editors share the full available block library, secondary toolbar, left-side current-block list, Canvas/Outline views, responsive widths, contextual toolbar, and Inspector.

<table>
    <caption>Block Editors</caption>
    <thead>
        <tr>
            <th>Control</th>
            <th>Purpose</th>
        </tr>
    </thead>
    <tbody>
        <tr><td>Blocks</td><td>Search and insert available blocks</td></tr>
        <tr><td>Current-block list</td><td>Inspect/rearrange the current tree; contextual copy/cut/paste and related actions</td></tr>
        <tr><td>Canvas</td><td>Review rendered output and select blocks visually</td></tr>
        <tr><td>Outline</td><td>Edit nested structure and insertion positions</td></tr>
        <tr><td>Contextual toolbar</td><td>Quick actions for the selected block</td></tr>
        <tr><td>Inspector</td><td>Detailed block settings and appearance</td></tr>
        <tr><td>Undo/Redo</td><td>Bounded edit history</td></tr>
        <tr><td>Desktop/Tablet/Mobile</td><td>Fixed canvas widths, not full device emulation</td></tr>
    </tbody>
</table>

**Theme template roots appear as Body**, applying root appearance to the editor document's HTML body. **Content roots appear as Main**. Post/page canvases show only the current entry's blocks, without shared headers/footers or an automatically inserted title. Add a heading/title block when needed; the public template can independently supply one. Container remains available as a normal block.

### Blocks and layout

- Layout blocks include Container, Group, Row, Columns, and Column.
- Content blocks include headings, rich text, HTML fragments, media, and other catalog entries.
- Site-context blocks include navigation, search, post lists, pagination, metadata, current content, and shared-part references.
- Interactive blocks include Swiper Slider, Slide, glTF, and Overlay.
- Active extensions and themes can contribute declarative blocks.

The live library and `shared/theme-blocks.json` are the complete catalog. Site-context blocks may have limited meaningful output in a content-only preview. Columns accepts Column children. Movement cannot create descendant or shared-part cycles. Theme trees support up to eight nesting levels and 2,000 blocks.

A Slider contains Slide blocks and uses Swiper settings for behavior/navigation. Slide backgrounds support image, video, and glTF, with applicable position/repeat controls. Overlay accepts nested blocks and renders above its slide/model background.

### Appearance controls

Reusable popovers cover color, gradients, background, typography, layout, dimensions, margin, padding, border, link, animation, glass, and slide backgrounds. Color uses a custom drag wheel. Gradient stops slide along their track; clicking the track adds a stop. Applicable numeric controls expose units and `auto` values.

Layout includes display-dependent flex controls, position/offsets, z-index, and transform ranges/inputs. Supported blocks expose max width and optional min height. Generic animation supports looping but is not used for Slider animation, which Swiper controls.

### HTML mode

HTML mode edits the selected **Rich text or HTML fragment block**, not the entire page document or serialized block tree. With no applicable selection, it selects an existing rich-text block or creates one. Surrounding structured blocks remain intact.

Safe source is retained on that block. Scripts, styles, frames, embeds, forms, unsafe links, and event attributes are rejected or sanitized. HTML blocks cannot introduce arbitrary JavaScript. The source limit is 100,000 characters.

### Shortcuts

<table>
    <caption>Block Editor Shortcuts</caption>
    <thead>
        <tr>
            <th>Shortcut</th>
            <th>Action</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Ctrl/Cmd+S</td>
            <td>Save draft</td>
        </tr>
        <tr>
            <td>Ctrl/Cmd+Enter</td>
            <td>Publish in post/page editor</td>
        </tr>
        <tr>
            <td>Ctrl/Cmd+B</td>
            <td>Toggle Blocks outside typing fields</td>
        </tr>
        <tr>
            <td>Ctrl/Cmd+Shift+C / O</td>
            <td>Canvas / Outline</td>
        </tr>
        <tr>
            <td>Ctrl/Cmd+1 / 2 / 3</td>
            <td>Desktop / Tablet / Mobile</td>
        </tr>
        <tr>
            <td>Ctrl/Cmd+Z / Shift+Z</td>
            <td>Undo / Redo</td>
        </tr>
        <tr>
            <td>Alt+F10</td>
            <td>Focus theme contextual toolbar</td>
        </tr>
        <tr>
            <td>Escape</td>
            <td>Dismiss active drawer/context according to editor state</td>
        </tr>
    </tbody>
</table>

Segmented controls support arrow-key navigation. Editor shortcuts defer to typing where applicable. Drawer transitions respect reduced-motion preferences.

## Themes and templates

**Colossal Default** and **Colossal 2027** are protected bundled core themes. Themes supply declarative presentation; plugins supply capabilities.

**Colossal 2027** is an editable dark portfolio with silver liquid glass panels, sticky navigation, a three-column footer, and Projects and Resume templates. Its hero fills the viewport and displays a transparent full-body ice figure seated on a slender carved royal throne, preserving the artwork's aspect ratio. A persistent Three.js background has a partially cropped top-left moon, independently tumbling snowflakes, wind, terrain, stars, and an animated charcoal pixel veil. Smooth camera zoom and parallax respond to scrolling; transparent section backgrounds keep the scene visible. It is seeded inactive without changing existing content or the active theme; earlier Colossal 2027 trees receive the scene and glass upgrades while preserving authored copy, custom images, and scene settings. The shared Glass popover exposes blur and saturation. The 3D model block's `portrait` source exposes scene speed, zoom, veil, pixels, image, moon, snow, wind, lighting, pointer, scroll, and framing controls in theme, post, and page Inspectors. Reduced-motion preferences stop scene animation. See the [Colossal 2027 guide](docs/guides/colossal-2027.md) for activation, sample content, assets, and controls, and [artwork provenance](docs/guides/colossal-2027-artwork.md) for the exact image prompt and snowflake source.

Colossal 2027 project, education, and toolkit cards use `#17191bc9` glass backgrounds. Its pixel veil and animated rain lines share the same editable tint; the overlay defaults to 0.75 opacity. Lines extend across the canvas at 45 degrees and default to 2 px thickness and 0.35 opacity. The angle is calculated in pixels so it stays consistent on wide and narrow screens. Rain controls cover density, falling speed, stroke thickness from 0.3–4 px, and opacity. These controls appear in theme, post, and page Inspectors, and reduced-motion preferences stop their animation. The persistent background stretches between all four viewport edges with zero margin, including during scrolling and mobile viewport resizing.

**Template settings → Landing page at /** selects an optional Home template when `/` normally renders the post index. Choose **Follow site routing** to remove that preference. Colossal 2027 selects Home by default; separately configured post-index pages retain their normal routing.

<table>
    <caption>Default Theme</caption>
    <thead>
        <tr>
            <th>Default template</th>
            <th>Role</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Home</td>
            <td>Assigned homepage</td>
        </tr>
        <tr>
            <td>Page</td>
            <td>Ordinary page</td>
        </tr>
        <tr>
            <td>Posts</td>
            <td>Post index</td>
        </tr>
        <tr>
            <td>Single</td>
            <td>Individual post</td>
        </tr>
        <tr>
            <td>Search</td>
            <td>Search results</td>
        </tr>
        <tr>
            <td>404</td>
            <td>Missing route</td>
        </tr>
    </tbody>
</table>

Older themes gain missing role templates while retaining layouts and additional templates. Resolution prefers an applicable content override, then type default, then theme default, with a built-in fallback. Missing overrides remain stored rather than destroying content choices.

### Authoring workflow

1. Install a ZIP or create an independent copy of the default theme.
2. Open the editor, which starts with Home by default.
3. Edit templates/shared parts with blocks and Inspector controls.
4. Save a draft and review a canvas or signed site preview.
5. Publish the draft; an inactive theme is not activated automatically.
6. Activate its published version to control the public site.

Header, Footer, Sidebar, and Content parts are reusable. Put `core/content` in the Content part and reference it from templates that need the current entry body. Shared-part references can move within valid layouts; cycles are rejected. Publishing a shared-part edit preserves the current editor context.

Saves use numeric `revision` checks. Publishing increments the theme patch version and retains the previous published snapshot. Revert discards the draft; history restore creates a draft. Clone copies owned assets independently. Export prefers an existing draft and produces a portable ZIP; core exports receive a non-core identity. Active and core themes are protected from deletion.

### Packaging

A ZIP contains root `theme.manifest.json`, declared template/part/block files, styles/assets, and optionally `theme.draft.json` for editable trees. The manifest declares ID, version, CMS compatibility, templates, parts, blocks, and assets. Declared blocks require unique icon tokens.

Installation validates compatibility, archive structure/paths, required files, and content, then registers the theme inactive. HTML/CSS are sanitized and uploaded JavaScript does not execute. Exporting Colossal Default is the easiest compatible starter. See [theme development](docs/developers/themes.md) for package details; some specialized historical examples describe earlier prototype behavior.

## Previews and Storybook

<table>
    <caption>Previews and Storybook</caption>
    <thead>
        <tr>
            <th>Preview</th>
            <th>Behavior</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Theme Canvas</td>
            <td>Server-rendered unsaved theme document</td>
        </tr>
        <tr>
            <td>Content Canvas</td>
            <td>Unsaved current entry inside Main</td>
        </tr>
        <tr>
            <td>Signed theme preview</td>
            <td>Saved theme draft/published version without activation</td>
        </tr>
        <tr>
            <td>Public site</td>
            <td>Active published theme and eligible public content</td>
        </tr>
        <tr>
            <td>Storybook</td>
            <td>Isolated component examples with mock state</td>
        </tr>
    </tbody>
</table>

Signed preview links expire after **15 minutes** and bind to a theme revision. Saving/publishing invalidates older links. Generate a new link after changes. Preview access only grants media reads referenced by that theme; treat the link as temporary access.

Editor canvases use isolated frames. Reviewed parent-side runtime hosts provide slider/model interactivity instead of allowing arbitrary scripts from theme HTML. Live AdSense never loads in canvases or signed theme previews.

Run `pnpm storybook` and visit `http://localhost:6006/` for workspace, theme, and skeleton examples. `pnpm storybook:build` creates a static showcase, not a working production CMS.

## Media management

Search/filter the shared library, switch grid/list, upload/select media, edit metadata, and replace files while preserving stable IDs.

<table>
    <caption>Media Formats</caption>
    <thead>
        <tr>
            <th>Type</th>
            <th>Formats</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Image</td>
            <td>PNG, JPEG, GIF, WebP, static sanitized SVG</td>
        </tr>
        <tr>
            <td>Audio</td>
            <td>MP3, WAV, OGG</td>
        </tr>
        <tr>
            <td>Video</td>
            <td>MP4, WebM</td>
        </tr>
        <tr>
            <td>Model</td>
            <td>GLB, self-contained glTF, ZIP with one glTF and local resources</td>
        </tr>
    </tbody>
</table>

Images/audio/video must be **25 MB or smaller**. Model validation supports **100 MB**, but both Node adapters currently cap the whole HTTP request at **51 MiB**, including multipart overhead. Keep Node model uploads below that ceiling. Worker hosts may add limits. `MAX_MEDIA_UPLOAD_BYTES`, when supplied as an API binding, can lower the media limit but cannot raise the Node request ceiling.

Images require alt text. Models receive generated schematic posters; opening one loads its interactive preview. Uploaded models cannot reference remote resources. Direct model URLs must use HTTPS and permit browser CORS access.

Replacement retains IDs and must preserve media type. Deletion is blocked while content, settings, themes, or history reference a file. Private files require a session; published and authorized preview references permit public access. Stable URLs use `/api/media/:id/file`; posters use `/api/media/:id/poster`. Audio/video responses support byte ranges.

## Plugins and extensions

<table>
    <caption>Plugins and extensions</caption>
    <thead>
        <tr>
            <th>Category</th>
            <th>Plugins</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Locked core</td>
            <td>Dashboard, Media, Posts, Pages, Settings, Themes, Plugins, Production Connections</td>
        </tr>
        <tr>
            <td>Optional bundled</td>
            <td>Reading time, Announcement bar, Google Ads, Login Security, Maintenance</td>
        </tr>
    </tbody>
</table>

Core plugins stay active and cannot be changed through ordinary plugin management. Optional extensions expose menus/features when activated.

The Plugins page initially opens in **List view**, with alternating table row colors. Use the **Grid/List** icon buttons beside search to switch layouts. Core plugins are hidden initially; the visibility icon to the left of **View site** shows or hides them in either layout. Search and Installed/Available tabs apply to both views. Both display preferences are saved in browser local storage and restored after reloads and browser restarts on the same site. Clearing site storage restores the defaults. If browser storage is unavailable, the controls still work for the current admin session.

### Maintenance

Install and activate **Maintenance** from Plugins, then open its admin menu. It includes three editable layouts: **Quiet**, **Midnight**, and **Studio**. Maintenance mode starts disabled.

1. Choose **Edit** on a layout, or **New layout** to start blank. The shared Theme Editor provides blocks, Canvas, Outline, Inspector, responsive previews, CSS, and template settings.
2. Save drafts, preview privately as an administrator, then publish. Add templates through the editor's template menu; **Save as new layout** duplicates a layout. Version history supports restoring a published version as a draft.
3. Select the published layout and template, set **Retry after** (60–86,400 seconds; default 3,600), and save settings.
4. Use the **Maintenance On/Off** switch immediately left of **View site** on the Maintenance page. Green means on; red means off. Switching saves immediately using the published layout settings. Switch off to reopen the site. Deactivating the plugin also stops maintenance without deleting layouts.

Anonymous visitors receive the published maintenance page with **HTTP 503**, `Retry-After`, `Cache-Control: no-store`, and `X-Robots-Tag: noindex`. Signed-in administrators retain normal site access. Login, setup, admin, health checks, cron, and assets remain reachable. Public content listing is suppressed during maintenance. Drafts and maintenance previews require administrator access; publishing a draft updates the active layout immediately.

Layouts are independent of site themes and use the configured database's `config` record named `maintenance`. Media uses the existing library and storage provider, and referenced files are protected against deletion. There is no maintenance ZIP upload, installation, or export workflow. See the [Maintenance API and developer guide](docs/developers/maintenance.md).

### MongoDB heartbeat

Production Connections includes a **MongoDB heartbeat** panel at the bottom of the Connections page. It sends a native MongoDB `ping` command with a 10-second timeout to the configured MongoDB database, or to MongoDB GridFS storage when the database provider is Cloudflare D1. SQLite and D1 without GridFS have no MongoDB target. The heartbeat runs on the server, so the admin browser does not need to remain open.

#### Enable and verify heartbeat

1. Open **Connections**. Production Connections is a core plugin that is automatically installed, always active, and cannot be deactivated or uninstalled. Existing installations are upgraded on startup without resetting connection or heartbeat settings.
2. For Vercel, configure the Production `CRON_SECRET` and redeploy using the [Vercel setup instructions](#vercel). Persistent Node hosting starts its scheduler with `pnpm start`.
3. Check **Enable scheduled heartbeat**, choose an interval, and save.
4. Select **Ping now** to verify connectivity, then use **Refresh status** to check subsequent scheduled results.

| Control                    | Default / behavior                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Enable scheduled heartbeat | Disabled by default; the core Connections plugin is always active.                                                       |
| Interval                   | Whole days from **1–14**; defaults to **1 day**.                                                                         |
| Save                       | Persists the enable setting and interval without discarding the last result.                                             |
| Ping now                   | Performs a manual ping, including when scheduled heartbeat is disabled. A successful ping updates the next eligible day. |
| Refresh status             | Loads the latest persisted result and scheduling capabilities.                                                           |

Once daily is the CMS recommendation because Atlas Free clusters can auto-pause after 30 days of inactivity. It provides margin without frequent polling; it is not an Atlas-required frequency. See [Atlas inactivity rules](https://www.mongodb.com/docs/atlas/pause-terminate-cluster/).

#### Scheduling and hosting

| Hosting            | Scheduling behavior                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel Production  | `vercel.json` schedules `/api/cron/mongodb-heartbeat` daily around **12:00 UTC** (`0 12 * * *`). The saved interval determines whether a ping is due. Vercel Hobby timing can vary within the scheduled hour. |
| Vercel Preview     | Production cron scheduling does not run automatically on preview deployments.                                                                                                                                 |
| Persistent Node    | A server timer checks for due work once per minute and pings only at the saved day interval. It stops when the server shuts down and cannot run while the hosting process is asleep or stopped.               |
| External scheduler | May call the authenticated cron endpoint on a running Node deployment. It requires `CRON_SECRET`; static-only hosting cannot execute the backend.                                                             |

Vercel requires a random **`CRON_SECRET` of at least 32 characters** in its Production environment and a redeployment after changing it. Vercel sends `Authorization: Bearer <CRON_SECRET>`; the handler validates authorization before initializing the database runtime. Do not put this secret in a URL or commit it. It is separate from the initial-owner `CMS_SETUP_TOKEN` and remains necessary after setup.

Intervals use **UTC calendar days** to accommodate cron timing variation. Changing the interval in Connections does not require redeployment. A persisted lease prevents simultaneous scheduled/manual invocations from duplicating work and expires after 10 minutes if a run terminates unexpectedly. Failed pings use a one-hour retry backoff on persistent Node; Vercel retries at its next daily invocation.

#### Status and troubleshooting

The panel displays **last result** (`never`, `running`, `success`, or `failed`), last attempt, last successful ping, duration, invocation source, and next eligible day. Settings and status are stored separately in the existing `config` collection/table. Failure messages omit credentials and raw provider errors. If MongoDB cannot be reached, saving the failed status may also fail; check server logs for the safe diagnostic.

Disabling the checkbox stops explicit scheduled ping commands. On Vercel, the daily cron still reads settings and a cold invocation initializes MongoDB clients. To stop **all scheduled database access**, remove/disable the cron job or remove its configuration and redeploy. Normal site requests continue using the database. A paused Atlas cluster may need manual resumption in Atlas, and heartbeats cannot guarantee availability during database or hosting outages. `/healthz` reports application readiness and does not replace a fresh MongoDB ping.

#### Heartbeat API

Admin endpoints require an authenticated administrator and the core Connections plugin; POST requests require same-origin JSON. Heartbeat settings remain writable on Vercel even though its environment-configuration panel is read-only.

| Method | Endpoint                                | Purpose                                                         |
| ------ | --------------------------------------- | --------------------------------------------------------------- |
| GET    | `/api/admin/connections/heartbeat`      | Read settings, status, and scheduling capabilities.             |
| POST   | `/api/admin/connections/heartbeat`      | Save `{ "enabled": true, "intervalDays": 1 }`.                  |
| POST   | `/api/admin/connections/heartbeat/ping` | Send a manual ping with an empty JSON body (`{}`).              |
| GET    | `/api/cron/mongodb-heartbeat`           | Run scheduled work using `Authorization: Bearer <CRON_SECRET>`. |

The cron endpoint returns **200** for successful or skipped runs and **503** for a failed ping. Skip reasons include `disabled`, `not-due`, `already-running`, `retry-backoff`, `plugin-inactive`, and `not-mongodb`. Responses use `Cache-Control: no-store`. See the [heartbeat developer guide](docs/developers/mongodb-heartbeat.md) for additional scheduling and API details.

### Login Security

Login Security is an optional bundled plugin activated by default. It provides persistent IP attempt limits, automatic timed blocks, admin-managed blocks, sign-in activity monitoring and login-form retry countdowns. Open **Admin → Login Security** to configure it. See [Login Security workflows, hosting behavior and API](docs/developers/login-security.md).

### Google Ads

The extension integrates **AdSense display ads**, not campaign management or Google Ad Manager. Set publisher ID, numeric default slot, format, and sizing. Ads blocks inherit defaults and allow overrides. Live ads are off by default. With the plugin active, saving a valid publisher ID publishes a verification meta tag in public HTML and a plain-text `/ads.txt` file, even without an ad slot or live ads. Verify ownership in **AdSense → Sites** using the meta tag or ads.txt method and request review. See [site verification and browser-blocking troubleshooting](docs/developers/google-ads.md#site-verification-and-adstxt).

Configure verification from **Google Ads → Site verification**: independently enable the meta tag and `/ads.txt`, inspect their previews, and optionally enter custom plain-text ads.txt content. Leave custom content blank to generate Google's entry from the Publisher ID; custom content replaces the entire file. Save to publish. These controls work independently of live ads and default to enabled for existing installations.

On public pages, valid visible units load the validated asynchronous AdSense script once and initialize each unit once. Previews use placeholders. Deactivation suppresses live rendering but retains settings. Account approval and ad availability are outside the CMS.

### Plugin packages and development

Uploaded ZIPs are validated and stored **inactive**. Uploaded JavaScript execution/activation is currently disabled; installation does not mean code has run.

A package needs a root `plugin.manifest.json`, compatible CMS range, dependencies, and the module named by `runtime.entry`. Compatibility must include `0.0.1`; historical `>=2.0.0` examples do not match this release. Archive checks cover size, paths, CRCs, module presence, versions, and routes. Staging cleans up failed installs and retains prior versions for rollback. Uploads cannot replace bundled plugins.

Reviewed bundled extensions register manifests, allowlisted lazy Angular components, and authorized server handlers. Shared extension points include declarative blocks, media selection, skeletons, and namespaced editor panels. See the [plugin API](docs/plugin-api.md), [ZIP guide](docs/developers/plugin-zip.md), and [media/editor APIs](docs/developers/media-and-editor.md).

## Authentication and authorization

<table>
    <caption>Authentication and authorization</caption>
    <thead>
        <tr>
            <th>Role/access</th>
            <th>Capabilities</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Owner</td>
            <td>Protected administrator; cannot be demoted/removed through membership UI</td>
        </tr>
        <tr>
            <td>Administrator</td>
            <td>Content/media, settings, themes, plugins, connections, members, keys</td>
        </tr>
        <tr>
            <td>Editor</td>
            <td>Content and media management</td>
        </tr>
        <tr>
            <td>Anonymous</td>
            <td>Published content and eligible public media</td>
        </tr>
        <tr>
            <td>Read key</td>
            <td>Published-content integration endpoint only; no admin writes</td>
        </tr>
    </tbody>
</table>

Use **Connections → Member password** to set email/password directly. New accounts are Editors; existing accounts retain their role. Password changes revoke existing sessions. Use Settings to change eligible roles. No invitation email is sent.

Node passwords use bcrypt cost 12. Eight-hour session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Session token digests are stored with SHA-256. Setup/login attempts are rate-limited; logout revokes its session. There is no self-service reset-email workflow.

Read keys are generated in Settings, shown once, SHA-256 hashed at rest, and revocable. They cannot authenticate admin mutations.

### Runtime identity boundary

Node implements password screens and strips incoming identity headers. Native Workers require a trusted hosting gateway that authenticates users and overwrites identity headers. The legacy `/api/admin/setup` gateway flow is disabled in Node password mode. A raw Worker trusting browser identity headers is not a safe deployment.

`CMS_DEV_AUTH_BYPASS=true` enables explicit automatic identity only in loopback development. Production does not honor it.

## Databases, storage, and migration

<table>
    <caption>Databases, storage, and migration</caption>
    <thead>
        <tr>
            <th>Runtime</th>
            <th>Records</th>
            <th>Uploads</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>`pnpm dev`</td>
            <td>SQLite</td>
            <td>Local files</td>
        </tr>
        <tr>
            <td>Node production</td>
            <td>MongoDB or D1 REST</td>
            <td>GridFS, R2-compatible S3, persistent local files</td>
        </tr>
        <tr>
            <td>Native Worker</td>
            <td>D1 `DB` binding</td>
            <td>R2-compatible `STORAGE` binding</td>
        </tr>
    </tbody>
</table>

MongoDB uses the native **`mongodb` Node driver**, not Mongoose. Its adapter implements supported CMS operations and ensures collections, validators, and indexes. Record transactions require a replica set. The database defaults to **`ColossalCMS`**.

GridFS uses `<bucket>.files`, `<bucket>.chunks`, and `<bucket>.keys`; default bucket: `colossal_media`. It can accompany either MongoDB or D1 records on Node. GridFS itself does not require a replica set, but MongoDB record transactions do. Current downloads assemble files in memory.

D1 on Node uses the REST adapter and applies checked-in SQL migrations. R2-compatible storage uses the S3 adapter. Local production files require a persistent disk.

### Connections workflow

1. Open Connections; Production Connections is always active as a core plugin.
2. Select database and storage independently, enter values, and save.
3. Test connectivity/read access with **Test connections**.
4. Optionally check **Migrate local data to production**.
5. Run **Connect & initialize schemas**, watching timestamped console progress.
6. Restart production to use new settings.

Tests do not initialize schemas/copy files and do not prove all write/index permissions. Initialization/startup seed missing built-in themes, plugins, settings, and samples while preserving edits. Saving configuration does not switch development away from SQLite.

Values stay server-side in `.env.production` or host variables, not Angular bundles or CMS configuration rows. Host variables override file values and appear host-managed. Blank secrets preserve saved values; Show reveals one allowlisted secret and Hide masks it. Console run history is in memory and lost on restart.

### Optional local migration

The checkbox defaults off. The running server must access SQLite and upload files; use development if the production host has no local source.

- Read a consistent, read-only SQLite snapshot; never delete local data.
- Copy content/blocks, themes/history, revisions, settings, plugin packages/state, media/files, members/password hashes, API-key hashes, activity, and notices.
- Exclude sessions and migration bookkeeping.
- Preflight unique-key conflicts, edited production data, missing referenced files, and destination hashes.
- Skip identical data; replace untouched built-in samples with local edited versions where appropriate.
- Verify copied files with SHA-256 before transactional record batches of up to 50 statements.
- Retain completed files/batches after failure; retries skip identical work. This is not one globally atomic migration.

Avoid concurrent edits during migration. This workflow does not migrate an existing R2 provider to GridFS.

If production has no owner, initialization can register the local setup owner and bcrypt hash without full migration. It preserves an existing production owner/credentials, copies no other members or sessions in that case, and rejects email conflicts. Production browser setup writes directly to its active database.

## Environment configuration

Use [.env.example](.env.example) as a template. Never commit credentials or embed them in frontend code. Development does not automatically load `.env.production`; production startup and the Connections manager read it for their respective operations.

<table>
    <caption>Environment variables</caption>
    <thead>
        <tr>
            <th>Variable</th>
            <th>Purpose/default</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>`CMS_PUBLIC_URL`</td>
            <td>Required exact production HTTPS origin; no path/query/credentials</td>
        </tr>
        <tr>
            <td>`CMS_DB_PROVIDER`</td>
            <td>`mongodb` or `d1`; default `mongodb`</td>
        </tr>
        <tr>
            <td>`CMS_STORAGE_PROVIDER`</td>
            <td>`gridfs`, `r2`, or `local`; default `gridfs`</td>
        </tr>
        <tr>
            <td>`CMS_SETUP_TOKEN`</td>
            <td>Random 32–4096 character token until first owner credentials exist</td>
        </tr>
        <tr>
            <td>`CRON_SECRET`</td>
            <td>Random secret of at least 32 characters for authenticated MongoDB heartbeat scheduling. Set in Vercel Production and redeploy; Vercel sends it as a Bearer token.</td>
        </tr>
        <tr>
            <td>`CMS_ADMIN_EMAIL`</td>
            <td>Optional headless/legacy bootstrap email</td>
        </tr>
        <tr>
            <td>`CMS_ADMIN_PASSWORD_HASH`</td>
            <td>Optional bcrypt bootstrap hash; never replaces credentials</td>
        </tr>
        <tr>
            <td>`CMS_DATA_DIR`</td>
            <td>Dev data directory (default `.local`); production local-storage directory when selected</td>
        </tr>
        <tr>
            <td>`CMS_PORT`</td>
            <td>Development port, default `4200`</td>
        </tr>
        <tr>
            <td>`PORT`</td>
            <td>Production port, default `3000`, usually host supplied</td>
        </tr>
        <tr>
            <td>`CMS_DEV_AUTH_BYPASS`</td>
            <td>Explicit local-only identity bypass</td>
        </tr>
        <tr>
            <td>`CMS_E2E_SPEC`</td>
            <td>Optional selected Cypress spec</td>
        </tr>
        <tr>
            <td>`NODE_ENV`</td>
            <td>`production` on hosting</td>
        </tr>
        <tr>
            <td>`NODE_VERSION`</td>
            <td>Blueprint runtime selection: `24`</td>
        </tr>
    </tbody>
</table>

<table>
    <caption>Database and Storage Providers</caption>
    <thead>
        <tr>
            <th>Provider</th>
            <th>Variables</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>MongoDB records / GridFS</td>
            <td>`MONGODB_URI`, `MONGODB_DATABASE` (`ColossalCMS`), `MONGODB_DNS_SERVERS` (`1.1.1.1,8.8.8.8`)</td>
        </tr>
        <tr>
            <td>GridFS</td>
            <td>`MONGODB_GRIDFS_BUCKET` (`colossal_media`)</td>
        </tr>
        <tr>
            <td>D1 REST</td>
            <td>`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`</td>
        </tr>
        <tr>
            <td>R2-compatible S3</td>
            <td>`R2_ENDPOINT`, `R2_BUCKET`, `R2_REGION` (`auto`), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_FORCE_PATH_STYLE` (`false`)</td>
        </tr>
    </tbody>
</table>

MongoDB DNS accepts up to four comma-separated server IPs; blank explicitly uses system DNS. SRV connections require working SRV/TXT lookups. Use a standard cluster `mongodb://` URI if SRV queries are blocked. Encode reserved password characters in URIs.

Generate a setup token:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Store it in host secrets, complete setup, then remove it. Optional headless bootstrap uses `pnpm password:hash` interactively and matching email/hash variables.

## API reference

All paths are relative to the site's origin. IDs identify persisted records. `/api` is the common prefix; `/healthz` belongs to Node production.

### Request conventions

- Administrative operations require an authorized session; read keys are insufficient.
- Worker mutations require the exact same-origin `Origin` and `Content-Type: application/json`, including DELETE. Uploads accept multipart form data instead.
- Node authentication mutations also require same-origin JSON. Browsers send same-origin cookies automatically.
- Let the browser set multipart boundaries; do not manually set that content type for `FormData`.
- Errors generally return `{ "error": "message" }`; reference conflicts may include `references`.
- Common statuses: 400 validation, 401 authentication, 403 origin/permissions, 404 missing record, 409 conflict, 410 stale preview, 413 size, 415 content type, and 429 authentication rate limit.
- Ordinary connection responses mask secrets. Provider failures are sanitized to avoid leaking credentials.

[OpenAPI](docs/openapi.yaml) supplies existing schemas but retains historical version/auth descriptions and partial endpoint coverage. The tables below reflect current code for this release.

### Public and authentication endpoints

<table>
    <caption>Public and authentication endpoints</caption>
    <thead>
        <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Access/result</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>GET</td>
            <td>`/api/public`</td>
            <td>Public configuration, active plugins, published/due content, eligible media metadata</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>`/api/content`</td>
            <td>Published/due entries; `Authorization: Bearer <read-key>` required</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>`/api/themes/render`</td>
            <td>Render; query `path`, `q`, `page`, optional `themePreview`</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>`/api/themes/:id/assets/:path`</td>
            <td>Theme asset with publication/session/preview checks</td>
        </tr>
        <tr>
            <td>GET, HEAD</td>
            <td>`/api/media/:id/file`</td>
            <td>Media bytes with access/range handling</td>
        </tr>
        <tr>
            <td>GET, HEAD</td>
            <td>`/api/media/:id/poster`</td>
            <td>Model poster with access checks</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>`/login`, `/setup`</td>
            <td>Node authentication screens</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/auth/setup`</td>
            <td>Node setup: `{ email, password, token }`</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/auth/login`</td>
            <td>Node login: `{ email, password }`; sets cookie</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/auth/logout`</td>
            <td>Node logout: submit `{}` with current cookie</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>`/healthz`</td>
            <td>Node production readiness after initialization</td>
        </tr>
    </tbody>
</table>

### Workspace and content

<table>
    <caption>Workspace and content</caption>
    <thead>
        <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Role/purpose</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>GET</td>
            <td>`/api/admin/session`</td>
            <td>Verified session and auth mode</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/admin/setup`</td>
            <td>Trusted-gateway legacy setup only; disabled on Node password hosting</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>`/api/admin/state`</td>
            <td>Member workspace state; admin-only member/key metadata</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/admin/content`</td>
            <td>Admin/editor creates or updates entry</td>
        </tr>
        <tr>
            <td>DELETE</td>
            <td>`/api/admin/content/:id`</td>
            <td>Admin/editor deletes entry/revisions</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>`/api/admin/content/:id/revisions`</td>
            <td>Member reads up to 30 recent snapshots</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/admin/content/render`</td>
            <td>Admin/editor previews unsaved content</td>
        </tr>
        <tr>
            <td>DELETE</td>
            <td>`/api/admin/notices/:id`</td>
            <td>Member dismisses notice</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/admin/settings`</td>
            <td>Administrator saves settings/routing</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/admin/members`</td>
            <td>Administrator manages `{ email, role }`</td>
        </tr>
        <tr>
            <td>DELETE</td>
            <td>`/api/admin/members/:id`</td>
            <td>Administrator removes eligible member</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/admin/keys`</td>
            <td>Administrator creates `{ name }`; key returned once</td>
        </tr>
        <tr>
            <td>DELETE</td>
            <td>`/api/admin/keys/:id`</td>
            <td>Administrator revokes key</td>
        </tr>
    </tbody>
</table>

Content requires `kind`, `title`, `slug`, and `status`. Optional fields include `id`, `body`, `excerpt`, `publishAt`, `templateId`, `details`, `expectedUpdatedAt`, and `autosave`. Kind: `post`/`page`; status: `draft`/`pending`/`published`/`scheduled`. Limits: title 200 characters, slug 160, excerpt 500, body 100,000. Slugs must be unique lowercase alphanumeric segments separated by hyphens. Scheduled content requires a future timestamp.

Content preview accepts `{ content, contentBlocks?, mainSettings?, mainId? }` without saving. Updates should include the current concurrency token.

For block-based integrations, populate `details.contentBlocks` with declarative nodes rather than treating `body` as the complete layout. For example:

```json
{
  "contentBlocks": [
    {
      "id": "blk_intro",
      "type": "core/heading",
      "settings": { "text": "Welcome", "level": "h1" }
    }
  ],
  "contentMain": {}
}
```

Place this object under `details` in a content write. Block IDs must be unique within the tree, and types/settings must pass the active block validator. Use `children` for nested blocks. The server validates media references and layout constraints instead of trusting client-generated HTML.

### Media

<table>
    <caption>Media API</caption>
    <thead>
        <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Admin/editor operation</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>GET</td>
            <td>`/api/media`</td>
            <td>List metadata</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/media`</td>
            <td>Upload multipart `file`, `altText`, optional metadata</td>
        </tr>
        <tr>
            <td>PATCH</td>
            <td>`/api/media/:id`</td>
            <td>Edit metadata</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/media/:id/replace`</td>
            <td>Replace via multipart</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>`/api/media/:id/references`</td>
            <td>Inspect references</td>
        </tr>
        <tr>
            <td>DELETE</td>
            <td>`/api/media/:id`</td>
            <td>Delete unreferenced item</td>
        </tr>
    </tbody>
</table>

### Themes

Listings and the active manifest require membership. Document/package/edit operations require Administrator. Revision-sensitive actions need the latest numeric `revision`.
<table>
    <caption>Themes API</caption>
    <thead>
        <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Admin/editor operation</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>GET</td>
            <td>`/api/themes`</td>
            <td>List installed themes</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>`/api/themes/active`</td>
            <td>Active manifest</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/themes/install`</td>
            <td>Multipart ZIP install, inactive</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>`/api/themes/:id`</td>
            <td>Published/draft documents, revision, history</td>
        </tr>
        <tr>
            <td>DELETE</td>
            <td>`/api/themes/:id`</td>
            <td>Delete inactive non-core theme</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>`/api/themes/:id/export`</td>
            <td>ZIP export, preferring draft</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/themes/:id/render`</td>
            <td>`{ document, templateId, part? }` unsaved render</td>
        </tr>
        <tr>
            <td>PUT, POST</td>
            <td>`/api/themes/:id/draft`</td>
            <td>`{ document, revision }`</td>
        </tr>
        <tr>
            <td>PUT, POST</td>
            <td>`/api/themes/:id/templates/:templateId`</td>
            <td>`{ root, revision }`</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/themes/:id/publish`</td>
            <td>Publish saved draft: `{ revision }`</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/themes/:id/activate`</td>
            <td>`{ revision }`; returns affected fallbacks</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/themes/:id/preview`</td>
            <td>Signed URL; optional `{ draft: false }`</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/themes/:id/revert`</td>
            <td>Discard draft: `{ revision }`</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/themes/:id/restore`</td>
            <td>`{ historyId, revision }` to draft</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/themes/:id/clone`</td>
            <td>`{ name, revision }` independent copy</td>
        </tr>
    </tbody>
</table>

### Plugins and connections

<table>
    <caption>Plugins and connections API</caption>
    <thead>
        <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Operation</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>POST</td>
            <td>`/api/admin/plugins`</td>
            <td>Administrator manages bundled plugin state</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/plugins/install`</td>
            <td>Administrator stages uploaded ZIP</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/plugins/:id/:action`</td>
            <td>Admin actions: activate/deactivate/discard/rollback/uninstall; uploaded activation disabled</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>`/api/plugins/:id/files/:version/:path`</td>
            <td>Authorized file read; does not execute code</td>
        </tr>
        <tr>
            <td>GET, POST</td>
            <td>`/api/admin/google-ads`</td>
            <td>Administrator reads/saves AdSense settings</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>`/api/admin/connections`</td>
            <td>Administrator reads masked config/runtime</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/admin/connections/save`</td>
            <td>Save allowlisted environment values</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/admin/connections/reveal`</td>
            <td>Reveal `{ key }`</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/admin/connections/run`</td>
            <td>`{ action: "test" or "initialize", migrateLocal: boolean }`; returns `{ id }`</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>`/api/admin/connections/runs/:id`</td>
            <td>Poll status/sanitized operation console</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>`/api/admin/connections/password`</td>
            <td>Set `{ email, password }` </td>
        </tr>
    </tbody>
</table>

Connections endpoints require Administrator and the active plugin. Native Workers report read-only bindings; Node-only operations are unavailable.

Bundled plugin writes use `{ id, action }`, with `action` equal to `install`, `activate`, `deactivate`, or `uninstall`. Connection saves use a flat environment-key object such as `{ "CMS_DB_PROVIDER": "mongodb", "MONGODB_DATABASE": "ColossalCMS" }`; they do not accept arbitrary environment keys. Theme/plugin ZIP uploads both use multipart field `file`.

### Examples

Read published content with a Settings-generated key:

```sh
curl http://127.0.0.1:4200/api/content \
  -H "Authorization: Bearer YOUR_READ_KEY"
```

Render a public page:

```sh
curl "http://127.0.0.1:4200/api/themes/render?path=/about"
```

Create a draft from a signed-in, same-origin browser context:

```js
const response = await fetch("/api/admin/content", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    kind: "page",
    title: "About example",
    slug: "about-example",
    excerpt: "A short introduction.",
    body: "Hello from Colossal CMS.",
    status: "draft",
    details: {},
  }),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error);
console.log(result.id, result.updatedAt);
```

For curl mutations, authenticate through Node login, retain its cookie, and explicitly send the exact `Origin` and required content type. A read key cannot authorize those writes.

## Deployment

### Vercel

Use the root `vercel.json` with Framework preset **Other**, Node **24.x**, and output directory **`dist/client`**. Vercel uses the `api/cms.mjs` Function for authentication and the CMS API; it does not run `pnpm start`. Configure MongoDB/GridFS (or D1/R2) and the exact `CMS_PUBLIC_URL` in Vercel environment variables.

#### Configure `CRON_SECRET` for MongoDB heartbeat

1. Generate a random secret locally:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

2. In **Vercel → Project Settings → Environment Variables**, add the key **`CRON_SECRET`**, paste the generated value, and select **Production**. Use the value alone, without surrounding quotes. Keep it private; never commit it or paste it into logs.
3. **Redeploy** after saving. Environment updates do not change an already-running deployment.
4. Open **Connections → MongoDB heartbeat**, check **Enable scheduled heartbeat**, choose an interval, and save. The recommended default is **1 day**.
5. Use **Ping now** to verify connectivity, then check Vercel's cron logs and the panel's last-success status after the scheduled run.

The checked-in cron calls `/api/cron/mongodb-heartbeat` daily around **12:00 UTC**. Vercel automatically sends `Authorization: Bearer <CRON_SECRET>`; the application rejects missing/incorrect authorization before connecting to MongoDB. The saved interval controls which daily checks send a ping. Without `CRON_SECRET`, Vercel's scheduled heartbeat cannot run, although an authenticated admin can still use **Ping now**.

Do not remove `CRON_SECRET` after administrator setup: it is separate from the temporary `CMS_SETUP_TOKEN`. Disabling the heartbeat checkbox stops explicit pings; remove the cron schedule to stop all scheduled database access. See [heartbeat scheduling, limits and API](docs/developers/mongodb-heartbeat.md).

See [Vercel deployment](docs/developers/vercel.md) for setup, preview configuration, and serverless differences. Local production storage, dotenv writes, and background connection jobs are unavailable there. The platform's 4.5 MB Function payload limit also restricts media transfers and package operations.

### Node / Render

1. Commit source, migrations, lockfile, `.env.example`, and deployment configuration.
2. Create a Node service from root `render.yaml`, or configure equivalent settings.
3. Leave **Root Directory empty**; clear old `app` or `/` values on existing services.
4. Use Node 24 and pnpm 11.19.0.
5. Build: `pnpm install --frozen-lockfile --prod=false && pnpm build`.
6. Start: `pnpm start`; health check: `/healthz`.
7. Set exact HTTPS `CMS_PUBLIC_URL`, provider credentials, and random `CMS_SETUP_TOKEN` in hosting secrets.
8. Deploy, complete `/setup`, sign in, then remove the setup token.

The Blueprint provides MongoDB/GridFS defaults and prompts for secret values; it does **not** generate a setup-token value. Host variables override `.env.production`. Production binds to `0.0.0.0` on `PORT`.

Startup validates settings, connects providers, prepares schema/indexes or migrations, establishes authentication, and seeds missing built-ins before listening. Failures stop startup; there is no silent SQLite fallback. GitHub can host source/CI artifacts, but GitHub Pages cannot run this dynamic API.

### Native Worker

The build emits `dist/server/index.js` and `dist/client/`. Native deployment needs `DB`, `STORAGE`, and `ASSETS` bindings, applied SQL migrations, and a trusted identity gateway.

There is no general Wrangler configuration or `pnpm deploy` command supplied here. Configure host bindings, secrets, migrations, and access policy before deploying. Node password pages are not automatically part of the Worker bundle.

### Backups and operations

Back up records and blob storage together. For local SQLite, stop writes or take a consistent SQLite backup; copying only the main file during WAL writes may omit data. Keep environment credentials separate from source control.

The repository does not configure scheduled production backups. Use provider facilities and verify restoration. Migration retry is not a backup. Interrupted GridFS writes/cleanup can leave orphaned files or chunks needing maintenance. Account for in-memory media processing and request limits.

## Development and release workflows

### Typical change

1. Edit the owning application/component/handler.
2. Update schema/migrations for persistence changes; review generated SQL.
3. Format, type-check, and run relevant integration tests.
4. Build and review locally.
5. Use isolated E2E for changed workflows and Storybook for shared states.
6. Update docs for behavior, API, or environment changes.

```sh
pnpm format:check
pnpm lint
pnpm test
pnpm build
pnpm exec cypress install
pnpm e2e
pnpm storybook:build
```

### CI

GitHub Actions runs for pushes/PRs to `main` and `develop`, plus manual dispatch. It performs frozen install, formatting, TypeScript, Node tests, dependency audit, production builds, Cypress installation/workflows, and Storybook build.

Successful builds upload assembled output, runtime sources, plugins, migrations, and package/lock/workspace files as an artifact retained for 14 days. Artifact upload is not deployment; hosting approval/release policy is separate.

### Release maintenance

Keep package version, CMS compatibility constants, manifests, and user-facing version displays aligned. Exclude credentials, local data, caches, and temporary outputs via `.gitignore`.

A maintenance script has an explicit destructive reset mode:

```sh
node scripts/prepare-release.mjs --restore-local-defaults
```

**This resets local posts/pages, revisions, routing defaults, and the core theme to release defaults, and removes legacy Brilliant entries.** It preserves administrator credentials/connection settings. It is not part of build, startup, deployment, or routine upgrades. Back up before intentionally running it.

## Troubleshooting

<table>
    <caption>Troubleshooting</caption>
    <thead>
        <tr>
            <th>Symptom</th>
            <th>Check/action</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Old `app/` paths after moving files</td>
            <td>Run at root, reinstall there, clear hosting Root Directory</td>
        </tr>
        <tr>
            <td>Missing/stale UI</td>
            <td>`pnpm build`; partial Angular builds need `pnpm build:server`</td>
        </tr>
        <tr>
            <td>Port in use</td>
            <td>Stop prior process or change `CMS_PORT`; E2E uses 4201</td>
        </tr>
        <tr>
            <td>Admin redirects</td>
            <td>Expected when signed out; complete setup/login</td>
        </tr>
        <tr>
            <td>Setup closed</td>
            <td>Owner credentials exist; token cannot reset them</td>
        </tr>
        <tr>
            <td>Migration unavailable</td>
            <td>Local SQLite/files cannot be found by the server</td>
        </tr>
        <tr>
            <td>Local owner not in production</td>
            <td>Initialize Connections or complete production setup; dev remains SQLite</td>
        </tr>
        <tr>
            <td>MongoDB DNS error</td>
            <td>Check SRV/TXT access, DNS/VPN/firewall, or standard URI</td>
        </tr>
        <tr>
            <td>MongoDB denied operation</td>
            <td>Check database and read/write, collection, validator, index permissions</td>
        </tr>
        <tr>
            <td>Transaction failure</td>
            <td>MongoDB records need replica-set support</td>
        </tr>
        <tr>
            <td>Production startup failure</td>
            <td>Verify HTTPS origin, setup/bootstrap, credentials, migrations, provider access</td>
        </tr>
        <tr>
            <td>Preview invalid</td>
            <td>Generate a fresh link after changes or expiration</td>
        </tr>
        <tr>
            <td>Save Conflict (409)</td>
            <td>Preserve work, reload current revision, reconcile changes</td>
        </tr>
        <tr>
            <td>Model upload too large</td>
            <td>Node 51 MiB ceiling includes multipart overhead</td>
        </tr>
        <tr>
            <td>Blank Model</td>
            <td>Check WebGL, valid/local resources, direct-URL CORS, browser errors</td>
        </tr>
        <tr>
            <td>Media deletion blocked</td>
            <td>Inspect content/settings/theme/history references</td>
        </tr>
        <tr>
            <td>Uploaded plugin activation blocked</td>
            <td>Execution is disabled; use reviewed bundled extensions</td>
        </tr>
        <tr>
            <td>Ads placeholders</td>
            <td>Expected in previews/live-off mode; otherwise check activation/IDs</td>
        </tr>
        <tr>
            <td>Cypress missing</td>
            <td>Install binary, build, rerun E2E</td>
        </tr>
        <tr>
            <td>Production files disappear</td>
            <td>Use GridFS/object storage or persistent disk</td>
        </tr>
    </tbody>
</table>

### Documentation index

<table>
    <caption>Documentation index</caption>
    <thead>
        <tr>
            <th>Document</th>
            <th>Focus</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Administrator guide</td>
            <td>Day-to-day content/media/settings</td>
        </tr>
        <tr>
            <td>Theme guide</td>
            <td>Authoring, drafts, controls, publishing</td>
        </tr>
        <tr>
            <td>Architecture</td>
            <td>Applications, persistence, identity</td>
        </tr>
        <tr>
            <td>Theme development</td>
            <td>Packages, compiler, block trees</td>
        </tr>
        <tr>
            <td>Appearance pickers</td>
            <td>Reusable Inspector controls</td>
        </tr>
        <tr>
            <td>Production Connections</td>
            <td>Providers, migration, hosting</td>
        </tr>
        <tr>
            <td>Google Ads</td>
            <td>AdSense configuration/runtime</td>
        </tr>
        <tr>
            <td>Plugin API</td>
            <td>Bundled integration</td>
        </tr>
        <tr>
            <td>Plugin ZIP</td>
            <td>Packaging, staging, rollback</td>
        </tr>
        <tr>
            <td>Media/editor APIs</td>
            <td>Selection and editor panels</td>
        </tr>
        <tr>
            <td>Verification</td>
            <td>Recorded checks and limitations</td>
        </tr>
        <tr>
            <td>Historical V2 status</td>
            <td>Prototype specification tracking</td>
        </tr>
    </tbody>
</table>

This README describes the current repository implementation. Historical V2 labels identify specification iterations, not the current `0.0.1` release.

## License

Colossal CMS is licensed under the [MIT License](LICENSE). Copyright (c) 2026 Exenreco Bell.
