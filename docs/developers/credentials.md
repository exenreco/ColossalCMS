# Encrypted credentials

## Minimal production setup

For MongoDB with GridFS, set these six variables in your hosting secrets or private `.env.production` file:

| Variable              | Purpose                                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| `CMS_DB_PROVIDER`     | Explicit bootstrap database selector: `mongodb` or `d1`                         |
| `CMS_PUBLIC_URL`      | Exact HTTPS site origin used for authentication and request validation          |
| `MONGODB_URI`         | Database bootstrap connection; it cannot be stored inside the database it opens |
| `MONGODB_DNS_SERVERS` | Node SRV/TXT resolvers: `1.1.1.1,8.8.8.8`; explicitly blank uses system DNS     |
| `CMS_SETUP_TOKEN`     | Random token of at least 32 characters for first-run administrator setup        |
| `CMS_ENCRYPTION_KEY`  | Persistent 32-byte key encoded as 64 hexadecimal characters                     |

Set `CMS_DB_PROVIDER=mongodb` for MongoDB or `CMS_DB_PROVIDER=d1` for Cloudflare D1. The selector is read before opening the database and remains in your private environment. If omitted, MongoDB remains the compatibility default. Configure `MONGODB_DNS_SERVERS` explicitly alongside the MongoDB connection; the same resolvers remain the runtime fallback if it is omitted. Restart or redeploy after changing DNS. Database `ColossalCMS`, GridFS and bucket `colossal_media` are defaults. Generate a key on your own machine:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the key in hosting secrets, separate from the database and source control. Preserve it across deploys and back it up securely. Local development automatically creates a private `.local/credential-key` if no explicit key exists; retain that file when retaining the local database. Production never generates an ephemeral key. Member passwords continue to use bcrypt cost 12.

For D1 through the Node adapter, configure `CMS_DB_PROVIDER=d1`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` and `CLOUDFLARE_API_TOKEN` outside the database. GridFS still needs MongoDB bootstrap credentials; alternatively configure R2 after setup using a working initial storage provider. Native Workers retain their D1/R2 bindings and require a compatible mail adapter; this admin credential workflow is supplied by the Node and Vercel adapters.

`CRON_SECRET` is a separate hosting secret, required when using Vercel or external scheduled heartbeat requests. Generate a separate random value of at least 32 characters, save it in private `.env.production`, and add the same value to Vercel's Production environment variables before redeploying. Local dotenv files do not synchronize with Vercel. Vercel needs this environment variable to send the authentication header; storing it only in the CMS database cannot authenticate Vercel's requests. The persistent Node timer does not require it. Bootstrap setup/authentication secrets are not copied into plugin credential records.

## Storage and precedence

| Values                                                                                      | Storage                                   |
| ------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Database provider and bootstrap connection, encryption key, setup token, cron secret        | Private environment/hosting configuration |
| AI provider keys and Custom API URL                                                         | Encrypted database records                |
| SMTP username and password                                                                  | Encrypted database records                |
| Storage provider, GridFS bucket and R2 endpoint/bucket/region/credentials/path-style option | Encrypted database records                |
| Ordinary plugin settings, SMTP host/TLS/sender, AI output limits                            | Existing ordinary database configuration  |
| Member passwords                                                                            | Existing bcrypt hashes                    |

The connection manager resolves explicit hosting environment overrides first, encrypted database settings second, legacy local dotenv settings third, then defaults. Production launch merges `.env.production` with its environment; supplied launch values are treated as explicit overrides. Blank secret fields preserve existing credentials. Hosted overrides remain read-only. Remove optional plugin overrides after migration if you want the admin to manage those values.

AI and SMTP use fresh configuration for each request; their changes work without redeployment. Storage clients are initialized at startup, after the database opens and encrypted storage settings are loaded. Restart or redeploy after storage changes. Changing the storage provider does not copy existing uploads to the new provider.

If `CMS_ENCRYPTION_KEY` is missing or malformed, existing environment credentials still work when no encrypted records need decryption, but encrypted credential writes are disabled. Encrypted records never silently fall back to legacy values when decryption fails.

## Existing installations

1. Configure a persistent `CMS_ENCRYPTION_KEY` in hosting secrets and redeploy.
2. Open **Connections → Encrypted plugin credentials**.
3. Select **Migrate existing plugin credentials** to copy eligible AI, SMTP and storage configuration.
4. Existing encrypted records are preserved; repeating the migration skips them. Source environment values/files are not deleted or edited.
5. Remove copied plugin environment overrides when ready, redeploy, and verify the integrations. Retain database bootstrap values, the encryption key and any required cron secret.

Copying and activating overrides are separate steps: source values continue to take precedence until removed. The credential migration affects the currently running database. The separate local-content migration excludes reserved encrypted credential records, preventing data encrypted under a development key from overwriting production credentials.

## Shared server API

`server/credential-store.mjs` supplies the shared service. Node/Vercel runtime exposes it as `env.CREDENTIALS` and through `env.CONNECTIONS.vault`.

| Method         | Behavior                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `values()`     | Resolve allowlisted values for server-side use; never send this object to the browser               |
| `describe()`   | Source/configured/managed metadata, write availability, migration candidate names; no secret values |
| `save(values)` | Validate allowlisted names, encrypt a batch and save; reject hosting overrides                      |
| `migrate()`    | Explicitly copy eligible environment/dotenv values, preserving existing records                     |
| `writable()`   | Whether the supplied master key has the required format                                             |

New plugin integrations extend the server-owned allowlist and consume this service instead of writing plaintext secrets into their plugin settings or dotenv files. Callers must enforce administrator access and same-origin requests before writes. SMTP continues to use the shared mail service; plugins should not create separate SMTP credential handling.

Records use reserved `config` IDs `credential:<setting name>`. Each versioned envelope contains AES-256-GCM ciphertext, a fresh 96-bit random nonce and a 128-bit authentication tag. Additional authenticated data binds ciphertext to its field name. The master key is not stored in the database. The existing config schema works with SQLite, MongoDB and D1; no separate credential-table migration is required.

## HTTP API

| Method | Endpoint                                     | Access/result                                                                 |
| ------ | -------------------------------------------- | ----------------------------------------------------------------------------- |
| `GET`  | `/api/admin/connections`                     | Admin-only metadata including `credentials.writable` and migration candidates |
| `POST` | `/api/admin/connections/credentials/migrate` | Admin, same-origin JSON; copied count and safe instructions, no secret values |
| `POST` | `/api/admin/connections/save`                | Allowlisted configuration changes; Vercel permits database-backed fields only |
| `POST` | `/api/admin/ai-assistant/settings`           | AI settings and encrypted provider credentials                                |
| `POST` | `/api/admin/settings/smtp`                   | SMTP settings and encrypted account credentials                               |

Saved encrypted secrets cannot be revealed through `/connections/reveal`; enter replacements to update them. The legacy reveal endpoint remains available for explicitly configured environment credentials. Plugin credentials are omitted from ordinary API responses, theme/plugin exports, logs and the portable local-content migration. Full database backups include encrypted records and require the separately backed-up master key for recovery.

## Recovery

If decryption fails, restore the original master key and redeploy. Tampered envelopes or a different key produce a fixed error; no stored credentials are changed. There is no automatic key rotation in this release. Do not replace `CMS_ENCRYPTION_KEY` while retaining encrypted records. Losing the key requires a deliberate recovery process that clears the affected reserved records and re-enters integration credentials; never reset them automatically on startup.

## Validation

```sh
node --test tests/credential-store.test.mjs tests/smtp.test.mjs tests/ai-assistant.test.mjs tests/production-connections.test.mjs
```

Tests cover encrypted persistence across restarts, fresh nonces, ciphertext field binding, missing/wrong keys, invalid input, override precedence, repeatable migration, local-content isolation, serverless credential writes and administrator/origin enforcement. Provider calls are mocked; tests do not use live API keys.
