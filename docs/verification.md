# Verification

## Release v0.0.1

App, plugin manifests, compatibility requirements and the admin footer now report 0.0.1. Brilliant core theme, its development export, generator, bundled models/images and theme-specific URL exceptions were removed. The local release workspace has only Colossal Default, the published About page and welcome post, and the sample draft post; local backup files were deleted. Administrator credentials and provider configuration were preserved. Release reset is explicit and never runs during normal startup or deployment. All 106 API/integration tests, five isolated theme browser workflows, TypeScript checks and production builds pass. The public site was checked in the browser and shows the default Journal/About navigation and welcome post. Historical backup paths below describe previous verification runs; those backups no longer exist.

## Setup administrator registration in production

Connection initialization now registers the locally configured setup owner and their bcrypt cost-12 password hash when production has no owner, without requiring full local migration. Tests verify sign-in with the original password, exclusion of sessions and other members/content, preservation of existing production owner credentials, rejection of email collisions, incomplete-setup handling, safe console messages and Test connections remaining read-only. All 106 tests, type checks and both app builds pass. Provider integration uses isolated databases/adapters; no live production account was changed during verification.

## First-run administrator setup and sign-in

Node hosting now serves token-protected `/setup` and `/login` screens, with signed-out admin redirects. First-run setup saves the owner and bcrypt credentials atomically and closes after success, including after restart. Local development signs in by default and generates an ignored token file; the explicit loopback bypass remains available. Tests cover invalid tokens/email/passwords, no account creation on validation failure, attempt limits, competing setup requests, migrated owners, duplicate member emails, same-origin enforcement, spoofed identity rejection, successful production/local sign-in, and setup remaining closed after restart. All 102 tests, type checks and both app builds pass. Integration tests use isolated local databases; production provider permissions still require configuration in Atlas.

## Connections member passwords

Connections accepts member email and password in one form, creating new Editors automatically. Verification covers admin-only access, normalized email, invalid email/password rejection without creating a member, successful sign-in, role preservation, password updates and session revocation. All 95 tests, type checks and production builds pass. Tests use isolated databases; no real member was created during verification.

## Node DNS configuration

MongoDB and GridFS now configure Node DNS from `MONGODB_DNS_SERVERS`, defaulting to `1.1.1.1,8.8.8.8`. The setting is editable in Connections and included in deployment examples. Resolver tests cover valid IPv4/IPv6 lists, invalid values, opting into system DNS, avoiding repeated resets during SRV polling, and requiring restart for changes. All 95 tests, type checks and builds pass. A live read-only MongoDB ping/replica-set check succeeded after overriding DNS. The complete provider test reached GridFS but Atlas denied reads on the selected `portfolio` database; no initialization or production migration was performed. Windows DNS settings were unchanged.

## Optional local-to-production migration

The Connections checkbox requests a read-only SQLite snapshot and verified upload copies during initialization. Built-in data initializes automatically even without a local source. All 92 tests pass, including copying local records and media, replacing untouched built-in defaults, idempotent retries, preservation of production conflicts, missing-upload rejection, failed file-copy recovery, exclusion of sessions, native Mongo adapter migration (including null drafts), and bound D1 REST migration batches. Type checks and production builds pass. Tests use isolated SQLite destinations, controlled Mongo/D1 adapters and local storage; live MongoDB/D1/R2/GridFS migrations require credentials and remain unverified. The development data has not been migrated to an external provider during verification.

## MongoDB GridFS provider

GridFS is available in Production Connections and the Node production runtime. Storage tests cover binary round trips, failed and concurrent replacement uploads, ambiguous publication responses, single/bulk deletion, invalid keys, authorized video byte ranges, read-only connection tests, idempotent collection/index initialization, D1 plus GridFS configuration, and async client cleanup. The suite has 85 passing tests; type checks, production build, and formatting checks pass. In-app browser inspection confirmed provider selection and MongoDB credential fields remain visible when D1 uses GridFS storage. No real MongoDB credentials were supplied, so live provider connections/uploads remain unverified. Development remains SQLite/local storage; existing files are not migrated.

## Production Connections (October 4, 2026)

The optional Production Connections plugin is installed and active locally. TypeScript, changed-file formatting, both Angular builds and the Worker build pass. All 80 tests pass, including provider configuration masking/persistence, connection run logs, Mongo SQL translation and transactions, Mongo-backed CMS initialization/content/rendering, D1 migration idempotence and Wrangler adoption, S3 blob operations, bcrypt credentials/session expiry and revocation, and the Node production server's identity-header rejection/sign-in/sign-out. Provider tests use controlled mocks or local adapters; no live MongoDB, D1 or R2 credentials were provided and no hosted deployment was made.

Browser checks verified provider-specific fields, secret Show/Hide controls, environment save, and missing-configuration feedback in the console. Development still runs on SQLite and local files. Before the authentication-table migration, the database was backed up to `.local/backups/pre-production-connections-1791159335065.sqlite`. Content, themes, theme history and media were compared with the backup and preserved. SQLite integrity is `ok`. No local member password was created during verification.

## Standard templates and 404 routing

Validated October 1, 2026. New and existing themes expose Home, Page, Posts, Single, Search and 404 templates in the Theme Editor. The migration preserves legacy layouts, drafts, extra templates and content; generated role templates keep legacy styling and add the blocks needed for posts or search results. The assigned Home page uses Home, while Latest posts at `/` uses Posts. The assigned 404 page renders through the 404 template on unmatched URLs, is excluded from site navigation and is no longer served as an ordinary page at its own slug.

Admin, Frontend and Worker builds, TypeScript and changed-file formatting checks pass. All 53 API tests and 30 isolated Cypress workflows pass, including template migration, template selection and assigned 404 page rendering. The local database was backed up to `.local/backups/pre-theme-roles-20261001.sqlite`, then again to `.local/backups/pre-theme-roles-v2-20261001.sqlite` before the final compatibility update; both snapshots passed SQLite integrity checks. After migration, all six content entries and both themes remain; content, media and theme history rows match the final backup, as do the original Page layouts in both themes.

## Post and page block editor update

Validated October 1, 2026. Posts and pages share the Theme Editor secondary and contextual block toolbars, a sliding Blocks drawer, an unsaved-content Canvas preview, the nested Outline, responsive widths, Undo/Redo, drag/drop model and Inspector. Authors can use the full active core catalog and the active theme's custom definitions, including Container, Row and Columns; a Columns block starts with two Column children. Block trees save as `details.contentBlocks` and render through the theme compiler on published pages. Existing rich-text content opens as one Rich text block. HTML mode edits the selected Rich text or HTML fragment block, preserving safe source markup through mode switches and saves as well as the surrounding layout. The Excerpt field stays in the right panel. Unsafe scripts, embeds, forms, links and event attributes are rejected from HTML source.

The Admin and Worker bundles build, TypeScript and changed-file formatting checks pass, all 51 API tests pass, and the 28 Cypress workflows pass against disposable test data. Browser cases cover post/page source editing, safe HTML markup round trips for posts, pages and HTML fragment blocks, live draft rendering, Canvas and Outline switching, site header clicks that retain the draft preview, selected block toolbar formatting and actions, the sliding drawer, dragging a block onto Canvas or an occupied outline, nested Columns, Inspector changes, existing block reordering, published layout rendering, media selection, unsafe source rejection, unsaved-source navigation and phone-width layout.

## V2.0.5 verification

Validated September 30, 2026 against **Colossal CMS - V2.0.5.pdf**. The production Admin and Frontend bundles, Worker bundle, and Storybook build; TypeScript checks pass. All 48 API tests pass, including routing roles and fallback, Content-part migration, 18 active core blocks, strict Columns structure, and glTF bundle validation. All 15 isolated Cypress workflows pass, including repeated drawer drags, occupied drop targets, contextual Heading controls, Columns wrapping, and Pages author filter/Quick Edit. Browser tests use disposable databases and do not change the workspace database.

Model uploads accept GLB, self-contained glTF and ZIP bundles after resource and geometry-budget checks. Model cards show a generated schematic poster; the poster is not a camera render of the uploaded geometry. The live Three.js viewer loads on demand. External hosted deployment and real GPU/browser matrix testing remain unverified.

The local database was backed up to `.local/backups/pre-v205-20260930.sqlite` before starting the V2.0.5 app at port 4200. The backup and running database each contain six content records, two themes, and one media item; local Admin, Frontend, theme, and state requests return HTTP 200.

During final verification the inactive copied theme was absent from the running database, while a newer content revision had appeared. A second snapshot was saved at `.local/backups/pre-theme-restore-v205-20260930.sqlite`; only the missing theme row was restored from the pre-V2.0.5 backup. The newer content revision was preserved. Both themes now appear in the local API.

## V2.0.4 verification

Validated September 28, 2026 against **Colossal CMS - V2.0.4.pdf**.

- Both Angular production apps and the Worker bundle compile successfully with strict template checking. TypeScript and Prettier checks pass.
- 40 API tests pass, including template cascade, manifest validation (now with the required-and-unique block icon rule), HTML/CSS sanitization, ZIP traversal and compression bombs, drafts/publishing/history, signed preview expiry and tampering, concurrent-save rejection, template overrides and fallback reporting, shared parts, plugin-contributed declarative blocks, independent cloned assets, export/reinstall, media reference protection, role enforcement, direct loading of dotted theme IDs, container min-height compilation across breakpoints, and plugin skeleton declarations.
- Twelve Cypress workflows pass against isolated data: V2 media/content authoring, unsaved content protection, theme ZIP installation and activation, drag-and-drop draft/publish, per-page template overrides/fallback warnings, and shared-part editing with undo/redo, duplicate/delete and propagation.
- V2.0.4 toolbar tests verify primary action order, centered Template, secondary DOM order and edge alignment at 1280/1440/1920px, 32px minimum targets, radio semantics, native Tab/arrow/Home/End navigation, shortcuts, 320px desktop push geometry, session scroll persistence, Escape focus return and responsive overlay dismissal. Screenshots are in `.local/cypress/screenshots/theme-toolbar.cy.mjs`.
- Occupied-container drag regressions verify moving existing canvas blocks between containers, before/after reordering, logical ordering inside columns, saved draft order, stationary drop indicators, and library drops onto occupied outline zones and container rows. Canvas blocks now expose a working Move block handle; invalid self/descendant and protected-boundary drops are rejected before insertion.
- Cypress captures desktop/tablet/mobile editor previews and the nested outline under `.local/cypress/screenshots/themes.cy.mjs`. These are review screenshots with width assertions, not an automated pixel-diff baseline across operating systems.
- Storybook builds with media/editor stories, block library, heading inspector, nested canvas, and V2.0.4 secondary toolbar variants (desktop, mobile preview and outline).
- No dependencies were added for V2.0.4. The earlier V2.0.2 dependency audit found no known vulnerabilities; no new network audit was run.
- The V2.0.4 local app runs at port 4200. Before startup, its database was backed up to `.local/backups/pre-v204-20260928-173745.sqlite`; all five existing content records remain. Uploads were unchanged. Isolated tests do not modify the local workspace database.
- V2.0.4 screenshots were reviewed for the full 1280px toolbar, both drawers and the responsive overlay. Wider viewport alignment is verified by bounding-box assertions; Electron screenshot output is limited to its 1280px capture surface. Earlier manual inspection covered grouped navigation, live theme cards and mobile navigation.

## Existing limits

Uploaded plugin ZIP execution remains disabled pending the earlier explicit approval of trusted runtime execution. Declarative theme activation works and does not execute uploaded scripts. See [V2 status](v2-status.md).

No hosted release was made. Hosted D1, storage, authentication and release environments remain unverified; local builds and browser tests do not establish a production deployment. The checked-in CI workflow has not run on a remote repository.

## Legacy core block icon repair

Migration `0003_theme_core_icons.sql` fills missing built-in block icons in installed manifests, published documents, drafts and history snapshots. It preserves existing icons, custom block metadata, layouts, assets, versions, revisions and activation state. Archive icon validation remains strict. An editor opened before the migration can still render and save its unsaved changes using canonical built-in icon metadata.

The local database was backed up to `.local/backups/pre-core-icon-fix-20260928.sqlite`. After applying the migration, both installed themes and both history snapshots were compared with the backup: only missing icons changed. Content rows were identical. Live render requests using the original legacy documents returned HTTP 200 for the core theme and its copy. Regression tests cover preservation, repeat execution, unknown blocks and legacy editor draft saves.

## Drawer drag freeze repair

Drawer blocks use pointer capture instead of native OS drag-and-drop across the canvas iframe. Pending preview responses cannot replace the canvas while a drag is active; queued changes render after drop or cancellation. Escape, pointer cancellation, lost capture and window blur release pointer-drag state. Drop targeting reuses a DOM index instead of scanning every rendered block for every sibling.

Browser regressions cover repeated drawer-to-iframe drops at desktop and overlay widths, cancellation without insertion, editing/saving afterward, and a delayed render response arriving during a drag. The delayed-render regression failed before the fix. All 12 Cypress workflows pass. An actual in-app-browser mouse drag inserted a heading into an occupied container, then text editing and draft saving succeeded with no console errors. This manual check used isolated test data; the user's themes were unchanged.
