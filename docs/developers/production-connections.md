# Production Connections

Development continues to use `pnpm dev`, SQLite at `.local/colossal.sqlite`, and files in `.local/storage`. Installing this plugin does not change those providers or move existing content.

## Plugin workflow

Install **Production Connections** in Plugins, then open **Connections**. Choose MongoDB or Cloudflare D1 independently of storage, enter credentials, and save the environment. Values go to the server's `.env.production` file; they never go into the CMS database or Angular bundles. This file and temporary environment files are Git-ignored. `.env.example` contains placeholders and is safe to commit.

Secret values are omitted from initial API responses. **Show** requests one allowlisted value through an admin-only, same-origin, non-cacheable endpoint. **Hide** masks it again. Blank secret fields preserve saved values. Hosting environment variables take precedence over file values; the UI marks those fields as host-managed and prevents editing them. Edit these values in Render or your hosting dashboard instead.

**Test connections** pings the database and checks bucket access without modifying database structures or bucket objects. **Connect & initialize schemas** creates or updates required database structures and indexes, and automatically installs built-in themes, the plugin catalog, default settings and sample entries where missing. Production startup also ensures built-in data exists. Its console polls a server-side run and displays each operation with a timestamp, completion, or failure. Runs are bounded and kept in server memory, so restarting loses console history. Credentials and raw provider errors are excluded from logs. A new provider is used by the production server on restart, not switched during an admin request.

## Optional local-data migration

Check **Migrate local data to production** before **Connect & initialize schemas** to copy local SQLite records and uploads to the selected database and storage. The checkbox is off by default and applies only to initialization; testing connections never copies data. It is available when this server can access the development SQLite file. The development adapter uses its configured local data directory; the production adapter looks for `.local/colossal.sqlite` and `.local/storage`. Run the operation from development when these files are not available on the production host.

Migration reads SQLite through a read-only connection with a consistent database snapshot. It copies content and blocks, themes/drafts/history, revisions, settings, plugin state/packages, media metadata, members, stored password hashes, API-key hashes, notices and activity. Login sessions and schema migration tracking are excluded. Built-in static assets remain bundled with the production build. Avoid editing local or production data while a migration is running.

Before writing, migration checks production rows and unique keys, referenced local uploads, and destination file hashes. Identical records/files are skipped. Untouched built-in defaults can be replaced with their local edited versions; conflicting production edits or files stop migration and are reported in the console. File copies are SHA-256 verified before database records are written. Database writes run in transactions of up to 50 statements. Successful files and batches are retained if a later operation fails, and retry skips matching data. This is not an all-or-nothing transaction across database and storage. Local source data is never deleted or switched. Review conflicts before retrying and keep backups for recovery.

If the migrated owner has no password credential, configure `CMS_SETUP_TOKEN` and use `/setup` to finish administrator sign-in. The existing owner ID and content remain intact. Alternatively, use the legacy email/hash bootstrap described below. Existing password credentials are preserved; migration does not copy plaintext passwords or environment secrets. Migrated API keys retain their authorization, so revoke development-only keys before migration if they should not work in production.

## MongoDB

Node defaults `MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8`. Both the MongoDB database and GridFS connectors configure Node's DNS resolver before opening clients, allowing SRV/TXT lookups to bypass a system DNS server that refuses them. The setting appears in Connections and can contain up to four IPv4/IPv6 addresses, separated by commas. Leave it blank to use the system resolver, particularly for private DNS/VPC deployments. Hosting environment values override the local file. Restart Node after changing it: active clients retain their DNS setup to avoid resetting resolution while background SRV polling is in progress.

This changes DNS resolution inside the Node process, not Windows/network DNS settings. Node's `dns.resolve*()` uses these servers; `dns.lookup()` continues to use the OS resolver. See [Node DNS configuration](https://nodejs.org/api/dns.html#dnssetserversservers).

Connection failures display fixed, credential-safe diagnoses for DNS, network reachability, authentication, authorization, TLS certificates, standalone servers, duplicate indexes and schema validation. Raw driver messages and hostnames are not displayed. If `mongodb+srv://` fails because DNS refuses SRV/TXT lookups, check the host's DNS/VPN/firewall or copy Atlas's standard `mongodb://` connection string, including all its nodes and options. Do not invent node hostnames or disable TLS. See [Atlas connection troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/).

Set `CMS_DB_PROVIDER=mongodb`, `MONGODB_URI`, and `MONGODB_DATABASE`. Use Atlas or a MongoDB replica set: the CMS requires transactions for publishing, revisions, plugin updates, and credentials.

On initialization/startup, collections are created from the checked-in SQLite/Drizzle migration schema. Existing collections receive strict JSON schema validators; required fields, nullable fields, integer fields, primary-key indexes, unique slugs and emails, and other indexes are ensured. The Mongo adapter translates the CMS's supported prepared SQL statements into native Mongo reads, updates, joins and transactions. Unsupported SQL fails explicitly. MongoDB creates collections and indexes, not relational SQL tables. The CMS block documents and metadata retain their existing JSON representation so both backends have equivalent application behavior.

MongoDB schema/index updates can fail if preexisting data violates constraints. Fix that data before retrying; the plugin does not delete it. Provider credentials need access to create collections, update validators and create indexes. Schema operations run before ordinary CMS transactions.

## D1

On Node/Render, set `CMS_DB_PROVIDER=d1`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, and `CLOUDFLARE_API_TOKEN`. The database must already exist. Use an account-scoped token with D1 read/write permissions. The adapter uses Cloudflare's HTTPS query API, bound parameters and batch requests. Migrations under `drizzle/` are applied once, tracked in `local_migrations`; each migration and its tracking record are sent in one batch.

For a native Cloudflare Worker deployment, the existing `DB` and `STORAGE` bindings remain supported. Connections displays host-managed binding information; Node dotenv editing, MongoDB, and password authentication are not loaded into the Worker. Configure bindings/secrets with Cloudflare and apply `drizzle/` migrations through your deployment tooling before starting a native Worker. The existing trusted authentication gateway remains required for native Workers.

## R2 / S3-compatible storage

Set `CMS_STORAGE_PROVIDER=r2`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`. Set `R2_REGION=auto` for Cloudflare R2; use the service's actual region for other S3 providers. Enable `R2_FORCE_PATH_STYLE=true` when required by your provider. The bucket must already exist. Storage implements the same get/put/delete contract as local media, and media remains served through authorized CMS endpoints.

R2 endpoints typically look like `https://ACCOUNT_ID.r2.cloudflarestorage.com`. Use HTTPS without credentials or paths in the endpoint. Connection tests issue a bucket HEAD request; they do not verify object write/delete permissions. Grant object read/write/delete permissions for normal media operations. `CMS_STORAGE_PROVIDER=local` also works on Node, but requires `CMS_DATA_DIR` on a persistent disk so files survive host restarts or deploys.

## MongoDB GridFS storage

Choose **MongoDB GridFS** in Production storage, or set `CMS_STORAGE_PROVIDER=gridfs`. Configure `MONGODB_URI`, `MONGODB_DATABASE`, and `MONGODB_GRIDFS_BUCKET` (default `colossal_media`). GridFS can store images, videos, audio and model files using MongoDB's chunked binary storage. It works with either MongoDB or D1 as the content database on Node/Render. When both providers use MongoDB, they share the configured database and use separate collections. GridFS alone does not require a replica set; the MongoDB content database still requires one.

Initialization creates `<bucket>.files`, `<bucket>.chunks`, and `<bucket>.keys`, with the standard GridFS file/chunk indexes and MongoDB's unique `_id` media-key index. Grant collection creation, indexing, and read/write/delete permissions. Connection tests only ping and read these collections; they do not upload files or verify write permissions. Each upload finishes before its media-key pointer is published. Failed replacements retain the previous file, and concurrent replacements update the pointer atomically. Superseded uploads are deleted after publication; a cleanup failure is logged and can leave an unreferenced file. Process termination during an upload can also leave orphaned chunks requiring maintenance.

Media stays behind the existing CMS endpoints and permissions, including video byte-range responses. Existing upload limits remain in effect; downloads currently assemble the file in memory, like the R2 adapter. Local media is copied only when the migration checkbox is selected; migrations from an existing R2 provider are not supported by this workflow. Restart production after saving the provider configuration. Native Cloudflare Workers continue to use their configured storage binding.

Implementation reference: [MongoDB Node driver GridFS](https://www.mongodb.com/docs/drivers/node/current/crud/gridfs/).

## Password sign-in

Node production hosting uses `/login`, bcrypt cost-12 password hashes, and eight-hour random HttpOnly/Secure/SameSite=Lax sessions. Only a SHA-256 digest of a session token is stored. Authentication credentials and sessions use the selected database (`auth_credentials` and `auth_sessions`). Invalid sign-in attempts are rate-limited. Incoming gateway identity headers are removed; the Node adapter establishes identity from a verified session. Sign out revokes the session.

For first-run Node hosting, configure a random `CMS_SETUP_TOKEN` of at least 32 characters in the hosting environment or server-side `.env.production`. Generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Do not commit it. Open `/admin/` to reach `/setup`, enter the token, and choose the owner's email and password. Setup saves a bcrypt cost-12 hash and redirects to `/login`. Setup is closed once the owner has credentials, including after restarts; the token cannot reset an existing password. Remove the token from hosting configuration afterward. Sites with a migrated owner but no password can complete setup while keeping the owner ID and content. Existing member emails cannot be reassigned to the owner.

The login and setup pages enforce same-origin JSON submissions, setup and login attempt limits, and secure HTTP-only session cookies on HTTPS production hosting. Browser-supplied identity headers are stripped. Signed-out admin navigation redirects to setup or login. The previous gateway owner-creation endpoint is unavailable in Node password-auth mode.

Optional headless/legacy bootstrap still accepts `CMS_ADMIN_EMAIL` and `CMS_ADMIN_PASSWORD_HASH`. Generate the hash with `pnpm password:hash` in an interactive terminal; password input is hidden and only the resulting hash is printed. For a preexisting owner without password credentials, the email must match that owner's email. Existing credentials are never overwritten from environment variables.

Local development now uses the same `/setup` and `/login` flow against SQLite. If `CMS_SETUP_TOKEN` is not supplied, the loopback server generates a token in the ignored `.local/setup-token` file and prints its path, not its value. Local HTTP cookies omit Secure; production cookies remain Secure. To explicitly retain the local automatic identity during development, start with `CMS_DEV_AUTH_BYPASS=true`; this flag is never honored by the production server. Existing local pages, themes and member IDs are preserved when setup adds owner credentials.

The plugin's **Member password** form accepts an email and password in one step. It adds a new Editor to the _currently running database_ or updates an existing member's password while preserving their role. Member creation and credentials are saved atomically after email and password validation. Existing sessions are revoked. Use Settings → Users to change roles. No invitation email is sent.

Connection initialization automatically registers the local setup administrator and their existing bcrypt cost-12 hash when the production database has no owner, even when local-data migration is unchecked. Existing production owner membership and passwords are preserved. Registration copies no sessions, other members, content or uploads. Email conflicts stop registration instead of taking another member’s access. Complete local `/setup` first. Other member credentials require local-data migration; production `/setup` always saves directly to the running production database. Local development continues to use SQLite until the Node production adapter is started. Passwords must be at least 12 characters and no more than bcrypt's 72 UTF-8 bytes. Passwords are not persisted in dotenv or plaintext database columns. Password/API-key hashing serve different purposes: the existing high-entropy API keys remain SHA-256 hashed.

## GitHub and Render

Commit source, lockfile, `.env.example`, migrations, and deployment configuration. Never commit `.env.production` or `.local`. GitHub can hold the repository; the dynamic API requires a server such as Render, not GitHub Pages.

From the workspace root, use `render.yaml` as a Blueprint or configure a Node service with the repository root (leave Render’s Root Directory empty), Node 24, build command `pnpm install --frozen-lockfile --prod=false && pnpm build`, and start command `pnpm start`. Set `CMS_PUBLIC_URL` to your site's exact HTTPS origin. Render supplies `PORT`; the server binds to `0.0.0.0`. `/healthz` is available after startup has connected, migrated and initialized the database. Graceful shutdown closes database/storage clients.

Add environment values in Render's dashboard. Its environment variables override `.env.production`, so secrets need not be stored on an ephemeral filesystem. The Blueprint defaults to MongoDB plus MongoDB GridFS; set the D1 variables and change the provider if using D1. Startup stops when production configuration, schema setup, storage connectivity or first-owner bootstrap fails; it never silently falls back to the development database.

Official references: [MongoDB collections and validation](https://www.mongodb.com/docs/drivers/node/current/databases-collections/), [D1 query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/), [R2 S3 SDK configuration](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/), [Render environment variables](https://render.com/docs/configure-environment-variables), and [bcrypt.js password limits](https://github.com/dcodeIO/bcrypt.js).
