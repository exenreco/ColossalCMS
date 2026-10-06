# MongoDB heartbeat

The **Connections → MongoDB heartbeat** panel configures an optional scheduled ping of the running MongoDB database, or MongoDB GridFS storage when the database is D1. A native `ping` command with a 10-second operation timeout is used; `/healthz` is not used as a substitute. Local SQLite and D1 without GridFS do not have a MongoDB target.

## Controls and defaults

Open Connections (Production Connections is an always-active core plugin), check **Enable scheduled heartbeat**, and save. The default interval is **1 day**, configurable from **1 to 14 days**. Once daily is the application recommendation: Atlas Free clusters can auto-pause after 30 days of inactivity, so daily activity provides ample margin without frequent polling. This is a CMS default, not an Atlas-required ping frequency. See [Atlas inactivity rules](https://www.mongodb.com/docs/atlas/pause-terminate-cluster/).

The panel shows the last result, last attempt, last successful ping, duration, invocation source and next eligible day. **Ping now** performs a manual connectivity test even when scheduled pings are disabled. **Refresh status** reads the persisted result. Settings and status are saved separately in the existing `config` collection/table, so updating settings does not discard history or overwrite an in-flight result. Raw provider errors and credentials are never recorded in heartbeat status.

Production Connections is automatically installed and always active as a core plugin; it cannot be deactivated or uninstalled. Disabling the checkbox stops explicit scheduled ping commands. Existing live MongoDB clients, normal site requests, status reads and scheduler configuration reads still access MongoDB; disabling pings does not disconnect the CMS from its database. A paused Atlas cluster may require manual resumption in Atlas. Heartbeats cannot guarantee availability during hosting/database outages.

## Vercel production

The committed `vercel.json` defines a production cron job:

```json
{ "path": "/api/cron/mongodb-heartbeat", "schedule": "0 12 * * *" }
```

1. Add **`CRON_SECRET`** to Vercel's **Production** environment. Use a random secret of at least 32 characters.
2. Deploy the updated application. Environment changes require a new deployment.
3. Open Connections and save the heartbeat checkbox/interval.
4. Use **Ping now** to test provider access. Verify scheduled invocations and results in Vercel logs and the panel.

Vercel includes `Authorization: Bearer <CRON_SECRET>` on scheduled requests. The adapter validates it with a constant-time hash comparison before initializing the database runtime. Missing or incorrect authorization cannot connect to the database through this route. The secret is never sent to the admin panel. Do not put the secret in a query string or commit it to the repository.

Vercel Hobby supports a daily schedule, with invocation timing potentially varying within its scheduled hour. The job checks daily around 12:00 UTC, and the saved interval determines whether a ping is due. Intervals use UTC calendar days so an earlier invocation the next day does not accidentally skip the default daily ping. Updating the interval in the panel does not change the cron expression and needs no redeployment. Preview deployments do not receive Vercel's production cron schedule. See [cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing) and [cron authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

The daily cron still reads the saved settings even when the heartbeat checkbox is disabled, and a cold invocation initializes MongoDB clients. To stop **all** scheduled database access, disable/remove the cron job in Vercel or remove its configuration and redeploy. Without a configured secret, scheduled requests are rejected before runtime initialization.

## Persistent Node hosting

`pnpm start` starts a server-side scheduler. It checks for due work once per minute and sends pings only at the saved day interval. The browser can be closed. Timers are cleared when the server shuts down; they cannot run while the hosting process is asleep or stopped. An external scheduler may call the same authenticated GET endpoint using `CRON_SECRET` for such hosting, but this does not turn a static-only deployment into a Node server.

A persisted compare-and-swap lease prevents simultaneous scheduler instances and manual invocations from sending duplicate pings. Leases expire after 10 minutes if an invocation terminates unexpectedly. Failed pings have a one-hour retry backoff on persistent Node; Vercel's daily schedule retries on its next scheduled invocation. Failures are classified into fixed, secret-safe messages. If MongoDB is unreachable, the failure may also prevent status persistence; a fixed diagnostic is written to server logs.

## API

Admin endpoints require an authenticated administrator, the core Connections plugin, and same-origin JSON for POST requests. Heartbeat settings remain writable when Vercel's environment-configuration panel is read-only.

| Method | Endpoint                                | Behavior                                                          |
| ------ | --------------------------------------- | ----------------------------------------------------------------- |
| GET    | `/api/admin/connections/heartbeat`      | Settings, last status and scheduling capabilities                 |
| POST   | `/api/admin/connections/heartbeat`      | Saves `{ enabled: boolean, intervalDays: integer }`               |
| POST   | `/api/admin/connections/heartbeat/ping` | Manual native MongoDB ping; returns updated status                |
| GET    | `/api/cron/mongodb-heartbeat`           | Scheduled run, protected by `Authorization: Bearer <CRON_SECRET>` |

Scheduled responses return a success/failure status or a skip reason (`disabled`, `not-due`, `already-running`, `retry-backoff`, `plugin-inactive`, or `not-mongodb`). A failed ping returns 503 from the cron endpoint. Successful/skipped invocations return 200. Responses use `Cache-Control: no-store`.
