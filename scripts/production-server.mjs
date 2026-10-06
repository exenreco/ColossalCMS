import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { parse } from "dotenv";
import worker from "../server/worker.mjs";
import {
  connectionManager,
  connectionDefaults,
  validateConnectionConfig,
} from "./connection-manager.mjs";
import { connectMongo } from "./mongo-database.mjs";
import { d1Database, migrateD1 } from "./d1-database.mjs";
import { s3Storage } from "./s3-storage.mjs";
import { connectGridFS } from "./gridfs-storage.mjs";
import { seedBuiltInData } from "./data-migration.mjs";
import { localStorage } from "./local-storage.mjs";
import { passwordAuth } from "./password-auth.mjs";
import { handleNodeAuth } from "./node-auth.mjs";
import { clientIp } from "./client-ip.mjs";
import { mongodbHeartbeat } from "../server/mongodb-heartbeat.mjs";
import {
  HEARTBEAT_PATH,
  authorizeHeartbeat,
  heartbeatResponse,
  startHeartbeatScheduler,
} from "./heartbeat-runtime.mjs";

export async function productionRuntime(config, log = console.log) {
  config = validateConnectionConfig({ ...connectionDefaults, ...config }, true);
  let DB, STORAGE;
  try {
    if (config.CMS_DB_PROVIDER === "mongodb")
      DB = await connectMongo(config, log);
    else if (config.CMS_DB_PROVIDER === "d1") {
      DB = d1Database(config);
      log("Connecting to D1…");
      await DB.prepare("SELECT 1 AS connected").first();
      await migrateD1(DB, log);
    } else
      throw new Error("Production requires CMS_DB_PROVIDER=mongodb or d1.");
    if (config.CMS_STORAGE_PROVIDER === "r2") {
      STORAGE = s3Storage(config);
      await STORAGE.test();
      log("R2 / S3 bucket connected.");
    } else if (config.CMS_STORAGE_PROVIDER === "gridfs") {
      STORAGE = await connectGridFS(config, log);
    } else {
      const dir = resolve(config.CMS_DATA_DIR || ".production", "storage");
      await mkdir(dir, { recursive: true });
      STORAGE = localStorage(dir);
      log("Local production storage selected; configure a persistent disk.");
    }
    const AUTH = passwordAuth(DB, { setupToken: config.CMS_SETUP_TOKEN });
    if (config.CMS_ADMIN_PASSWORD_HASH) {
      await AUTH.bootstrap(
        config.CMS_ADMIN_EMAIL,
        config.CMS_ADMIN_PASSWORD_HASH,
      );
    }
    if (await AUTH.setupNeeded()) {
      if (
        typeof config.CMS_SETUP_TOKEN !== "string" ||
        config.CMS_SETUP_TOKEN.length < 32 ||
        config.CMS_SETUP_TOKEN.length > 4096
      )
        throw Object.assign(
          new Error(
            "Set CMS_SETUP_TOKEN to a random token of at least 32 characters for first-run administrator setup.",
          ),
          { code: "CMS_SETUP_TOKEN_REQUIRED" },
        );
      log(
        "Administrator setup required. Open /setup and use the hosting setup token.",
      );
    }
    await seedBuiltInData(DB, log, config.CMS_ADMIN_EMAIL);
    return {
      DB,
      STORAGE,
      AUTH,
      PASSWORD_AUTH: true,
      HEARTBEAT: mongodbHeartbeat({
        db: DB,
        ping: DB.ping
          ? () => DB.ping()
          : STORAGE.ping
            ? () => STORAGE.ping()
            : null,
        mode: config.VERCEL === "1" ? "vercel" : "node",
        cronConfigured:
          typeof config.CRON_SECRET === "string" &&
          config.CRON_SECRET.length >= 32,
        log,
      }),
      CONNECTIONS: connectionManager({
        active: {
          database: config.CMS_DB_PROVIDER,
          storage: config.CMS_STORAGE_PROVIDER,
        },
      }),
    };
  } catch (e) {
    await DB?.close?.().catch(() => {});
    await Promise.resolve()
      .then(() => STORAGE?.close?.())
      .catch(() => {});
    throw e;
  }
}

export async function startProductionServer(
  config = process.env,
  runtimeFactory = productionRuntime,
) {
  const origin = new URL(config.CMS_PUBLIC_URL || "");
  if (
    origin.protocol !== "https:" ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  )
    throw new Error(
      "Set CMS_PUBLIC_URL to the HTTPS origin of your production site.",
    );
  const env = await runtimeFactory(config);
  const root = resolve("dist/client"),
    types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".json": "application/json",
    };
  env.ASSETS = {
    fetch: async (request) => {
      const file = resolve(
        root,
        "." + decodeURIComponent(new URL(request.url).pathname),
      );
      if (!file.startsWith(root + sep))
        return new Response("Forbidden", { status: 403 });
      try {
        return new Response(await readFile(file), {
          headers: {
            "Content-Type": types[extname(file)] || "application/octet-stream",
          },
        });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    },
  };
  const server = http.createServer(async (req, res) => {
    try {
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 51 * 1024 * 1024) {
          res.writeHead(413);
          res.end("Upload too large");
          return;
        }
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers))
        if (value)
          headers.set(key, Array.isArray(value) ? value.join(",") : value);
      // Browser-provided gateway headers never establish identity on Node hosting.
      headers.delete("oai-authenticated-user-id");
      headers.delete("oai-authenticated-user-email");
      headers.delete("x-cms-client-ip");
      const ip = clientIp(req);
      headers.set("x-cms-client-ip", ip);
      const request = new Request(new URL(req.url, origin), {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : Buffer.concat(chunks),
      });
      const path = new URL(request.url).pathname;
      if (new URL(request.url).origin !== origin.origin)
        throw Object.assign(new Error("Invalid request origin."), {
          status: 400,
        });
      let response;
      if (path === HEARTBEAT_PATH) {
        authorizeHeartbeat(request, config.CRON_SECRET);
        response = await heartbeatResponse(env);
      }
      const authResponse = response
        ? null
        : await handleNodeAuth(request, env.AUTH, ip);
      if (!response && path === "/healthz")
        response = Response.json({ ok: true });
      else if (!response && authResponse) {
        response = authResponse;
      } else if (!response) {
        const member = await env.AUTH.identify(request);
        if (member) {
          headers.set("oai-authenticated-user-id", member.id);
          headers.set("oai-authenticated-user-email", member.email);
        }
        if (!member && (path === "/admin" || path.startsWith("/admin/")))
          response = new Response(null, {
            status: 302,
            headers: {
              Location: (await env.AUTH.setupNeeded()) ? "/setup" : "/login",
            },
          });
        else
          response = await worker.fetch(new Request(request, { headers }), env);
      }
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      res.writeHead(error.status || 500, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          error: error.status
            ? error.message
            : "The server could not complete this request.",
        }),
      );
    }
  });
  server.listen(
    config.PORT === undefined ? 3000 : Number(config.PORT),
    "0.0.0.0",
    () => console.log("Production CMS is listening."),
  );
  const stopHeartbeat =
    config.VERCEL === "1" ? () => {} : startHeartbeatScheduler(env.HEARTBEAT);
  const close = () =>
    server.close(async () => {
      await env.DB.close?.();
      await env.STORAGE.close?.();
      process.exit(0);
    });
  process.on("SIGTERM", close);
  process.on("SIGINT", close);
  server.on("close", () => {
    stopHeartbeat();
    process.off("SIGTERM", close);
    process.off("SIGINT", close);
  });
  return server;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve("scripts/production-server.mjs")
) {
  let file = {};
  try {
    file = parse(await readFile(".env.production", "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  try {
    await startProductionServer({ ...file, ...process.env });
  } catch {
    console.error(
      "Production startup failed. Check environment settings, migrations, credentials and network access. Provider errors are omitted to protect secrets.",
    );
    process.exitCode = 1;
  }
}
