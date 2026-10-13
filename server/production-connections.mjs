import { DATABASE_CONFIG_KEYS } from "./credential-store.mjs";
import { mongodbHeartbeat } from "./mongodb-heartbeat.mjs";

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const json = (data) =>
  Response.json(data, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function handleConnections(
  request,
  env,
  user,
  log = async () => {},
) {
  if (user.role !== "admin")
    fail("Only admins can manage production connections.", 403);
  const plugin = await env.DB.prepare("SELECT active FROM plugins WHERE id=?")
    .bind("com.colossal.production-connections")
    .first();
  if (!plugin?.active)
    fail("Activate the Production Connections plugin first.", 409);
  const path = new URL(request.url).pathname,
    manager = env.CONNECTIONS;
  const heartbeat = env.HEARTBEAT || mongodbHeartbeat({ db: env.DB });
  if (path === "/api/admin/connections/heartbeat" && request.method === "GET")
    return json(await heartbeat.describe());
  if (
    path === "/api/admin/connections/heartbeat" &&
    request.method === "POST"
  ) {
    await heartbeat.save(await request.json());
    return json(await heartbeat.describe());
  }
  if (
    path === "/api/admin/connections/heartbeat/ping" &&
    request.method === "POST"
  ) {
    await heartbeat.run({ force: true, source: "admin" });
    return json(await heartbeat.describe());
  }
  if (
    path === "/api/admin/connections/credentials/migrate" &&
    request.method === "POST"
  ) {
    if (!manager?.vault)
      fail("Encrypted credentials are unavailable on this runtime.", 503);
    const result = await manager.vault.migrate();
    await log("Migrated plugin credentials into encrypted database storage");
    return json(result);
  }
  if (env.SERVERLESS) {
    if (request.method === "GET" && path === "/api/admin/connections")
      return json({
        ...(await manager.describe()),
        heartbeat: await heartbeat.describe(),
        readOnly: !manager.vault,
        jobsAvailable: false,
        fields: (await manager.describe()).fields.map((field) => ({
          ...field,
          readOnly: field.readOnly || !DATABASE_CONFIG_KEYS.has(field.key),
        })),
        message:
          "Database bootstrap settings are managed by your host. Plugin credentials and storage settings can be saved in the encrypted database. Storage changes need a redeploy; AI and SMTP credential changes apply immediately.",
      });
    if (
      path !== "/api/admin/connections/password" &&
      path !== "/api/admin/connections/reveal" &&
      !(path === "/api/admin/connections/save" && manager?.vault)
    )
      fail(
        "Configure Vercel environment variables and redeploy. Connection jobs and local dotenv writes require the persistent Node server.",
        409,
      );
  }
  if (!manager) {
    if (path === "/api/admin/connections" && request.method === "GET")
      return json({
        runtime: "cloudflare",
        heartbeat: await heartbeat.describe(),
        active: { database: "d1", storage: "r2" },
        fields: [],
        restartRequired: false,
        readOnly: true,
        message:
          "Cloudflare Workers use DB and STORAGE bindings. Configure D1, R2 and secrets with Wrangler or the Cloudflare dashboard; apply the checked-in migrations before deploying.",
      });
    fail(
      "This operation requires the Node hosting adapter. Cloudflare bindings are configured through the host.",
      503,
    );
  }
  if (request.method === "GET") {
    if (path === "/api/admin/connections")
      return json({
        ...(await manager.describe()),
        heartbeat: await heartbeat.describe(),
      });
    const match = path.match(/^\/api\/admin\/connections\/runs\/([a-f0-9-]+)$/);
    if (match) return json(manager.job(match[1]));
  }
  if (request.method === "POST") {
    const body = await request.json();
    if (path === "/api/admin/connections/save") {
      if (
        env.SERVERLESS &&
        Object.keys(body).some((key) => !DATABASE_CONFIG_KEYS.has(key))
      )
        fail(
          "Configure database bootstrap variables in your hosting dashboard and redeploy.",
          409,
        );
      const result = await manager.save(body);
      await log("Updated production connection configuration");
      return json(result);
    }
    if (path === "/api/admin/connections/reveal")
      return json(await manager.reveal(body.key));
    if (path === "/api/admin/connections/run")
      return json(
        await manager.start(body.action, { migrateLocal: body.migrateLocal }),
      );
    if (path === "/api/admin/connections/password") {
      if (!env.AUTH)
        fail("Password authentication is unavailable on this host.", 503);
      await env.AUTH.setPassword(body.email, body.password);
      return json({ ok: true });
    }
  }
  fail("Connection operation not found.", 404);
}
