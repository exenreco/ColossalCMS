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
export async function handleConnections(request, env, user) {
  if (user.role !== "admin")
    fail("Only admins can manage production connections.", 403);
  const plugin = await env.DB.prepare("SELECT active FROM plugins WHERE id=?")
    .bind("com.colossal.production-connections")
    .first();
  if (!plugin?.active)
    fail("Activate the Production Connections plugin first.", 409);
  const path = new URL(request.url).pathname,
    manager = env.CONNECTIONS;
  if (env.SERVERLESS) {
    if (request.method === "GET" && path === "/api/admin/connections")
      return json({
        ...(await manager.describe()),
        readOnly: true,
        message:
          "Vercel uses hosting environment variables. Configure providers in Project Settings and redeploy. Startup initializes schemas automatically. Run local migration from the development server; background console jobs are unavailable on this host.",
      });
    if (
      path !== "/api/admin/connections/password" &&
      path !== "/api/admin/connections/reveal"
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
      return json(await manager.describe());
    const match = path.match(/^\/api\/admin\/connections\/runs\/([a-f0-9-]+)$/);
    if (match) return json(manager.job(match[1]));
  }
  if (request.method === "POST") {
    const body = await request.json();
    if (path === "/api/admin/connections/save")
      return json(await manager.save(body));
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
