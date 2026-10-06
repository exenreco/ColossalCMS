# Login Security plugin

Login Security protects the built-in password login on local Node, production Node and Vercel hosting. It is installed and activated by default when the built-in catalog is initialized, including upgrades of existing sites. It remains an optional plugin; administrators can deactivate it in Plugins or disable protection in its settings. External gateway authentication on Cloudflare is not managed by this plugin.

## Administration

Open **Admin → Login Security**. Only administrators can view activity or modify settings and blocks.

| Setting            | Default    | Allowed range   |
| ------------------ | ---------- | --------------- |
| Attempt limit      | 10         | 1–100           |
| Attempt window     | 15 minutes | 1–1440 minutes  |
| Automatic block    | 30 minutes | 1–10080 minutes |
| Activity retention | 7 days     | 1–90 days       |

The limit applies to an IP address across all submitted accounts. Failed attempts against nonexistent accounts count in exactly the same way as attempts against real accounts. Successful authentication resets the current IP counter. Concurrent requests reserve an attempt before password verification so cold starts and parallel serverless invocations cannot bypass the limit. Windows use fixed time intervals; the final failed attempt at the configured threshold creates a temporary block.

The login form shows remaining attempts after invalid credentials. Blocked requests return HTTP 429. Temporary blocks include `Retry-After` and a countdown that disables submission until the retry time. The server enforces every block independently of browser state. Permanent blocks tell the visitor to contact an administrator.

Admins can add exact IPv4 or IPv6 addresses to the block list, optionally provide a reason, and choose a duration in minutes. A duration of 0 means permanent. CIDR ranges are not supported. The current session's IP cannot be manually blocked from that session, helping prevent accidental lockout. Existing authenticated sessions are not revoked by adding an IP block.

**Unblock & reset** removes the block and its attempt counters. Automatic and timed manual blocks expire without a scheduled task; counters from before expiry are cleared when activity is next read or a new login is attempted. Permanent manual blocks remain until removed. Disabling protection or deactivating the plugin suspends enforcement and monitoring; the original in-memory authentication throttle remains as a baseline when the plugin is inactive. Re-enabling protection restores unexpired blocks.

The panel shows up to 200 current blocks, 200 recent attempt windows and 200 recent sign-in events. Use its IP/email filter and Refresh activity button to inspect them. Activity includes submitted email, IP, outcome and timestamp. Passwords, password hashes, session tokens and setup tokens are never recorded in these tables. Activity retention cleanup runs during login and panel reads; permanent block entries are retained.

## Persistence and hosting

Migration `drizzle/0005_login_security.sql` adds `login_ip_windows`, `login_ip_blocks` and `login_events`. SQLite applies it locally, MongoDB derives its collections/validators/indexes from the migrations, and D1 uses the same SQL migration. Deploy the migration before running an updated Cloudflare Worker. Existing theme/content data is preserved.

Vercel uses its platform-overwritten `X-Forwarded-For` header when `VERCEL=1`. The local and standalone Node adapters use the socket peer and ignore arbitrary forwarded headers. IPv4-mapped IPv6 addresses normalize to the equivalent IPv4 address; IPv6 spellings normalize to a consistent representation. The adapters overwrite the internal `x-cms-client-ip` header so visitors cannot forge the admin panel's current IP.

A standalone Node server behind a reverse proxy currently sees the proxy's socket IP; use Vercel for verified per-visitor forwarding, or configure a reviewed trusted-proxy adapter before enabling IP enforcement on that hosting topology. Unknown client addresses share an `unknown` counter and cannot be manually added to the block list. IP blocking supplements authentication; users on a shared network can share a public IP.

## API

All endpoints require an authenticated administrator. POST requests require same-origin JSON, enforced by the shared API boundary.

| Method | Endpoint                             | Request / result                                                                           |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| GET    | `/api/admin/login-security`          | Settings, active state, current IP, blocks, windows, events and password-auth availability |
| POST   | `/api/admin/login-security/settings` | `{ enabled, maxAttempts, windowMinutes, blockMinutes, retentionDays }`                     |
| POST   | `/api/admin/login-security/block`    | `{ ip, reason, minutes }`; 0 minutes means permanent                                       |
| POST   | `/api/admin/login-security/unblock`  | `{ ip }`; clears block and counters                                                        |

Login still uses `POST /api/auth/login` with `{ email, password }`. Invalid credentials return 401 with `remainingAttempts` when protection is active. Blocked requests return 429, and temporary blocks include `retryAfter` in seconds and the `Retry-After` response header. The setup form retains its separate token-protected setup throttle.
