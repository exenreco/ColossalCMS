import { localStorage } from "./local-storage.mjs";
import { clientIp } from "./client-ip.mjs";
import { mongodbHeartbeat } from "../server/mongodb-heartbeat.mjs";
import http from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve, extname } from "node:path";
import { localDatabase } from "./local-database.mjs";
import worker from "../server/worker.mjs";
import { connectionManager } from "./connection-manager.mjs";
import { passwordAuth } from "./password-auth.mjs";
import { handleNodeAuth } from "./node-auth.mjs";
const dataDir = process.env.CMS_DATA_DIR || ".local";
const port =
  process.env.CMS_PORT === undefined ? 4200 : Number(process.env.CMS_PORT);
await mkdir(dataDir, { recursive: true });
const STORAGE = localStorage(resolve(dataDir, "storage"));
const DB = localDatabase(resolve(dataDir, "colossal.sqlite"));
const CONNECTIONS = connectionManager({ localDataDir: resolve(dataDir) });
const bypass = process.env.CMS_DEV_AUTH_BYPASS === "true";
let setupToken = process.env.CMS_SETUP_TOKEN || "";
const tokenFile = resolve(dataDir, "setup-token");
if (!bypass && (await passwordAuth(DB).setupNeeded())) {
  if (!setupToken) {
    try {
      setupToken = (await readFile(tokenFile, "utf8")).trim();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      setupToken = randomBytes(32).toString("hex");
      await writeFile(tokenFile, setupToken + "\n", {
        flag: "wx",
        mode: 0o600,
      });
    }
  }
  if (setupToken.length < 32 || setupToken.length > 4096)
    throw new Error("Use a setup token of 32 to 4096 characters.");
  console.log(
    "Local administrator setup required at /setup. Token file: " + tokenFile,
  );
}
const AUTH = passwordAuth(DB, { secure: false, setupToken });
const HEARTBEAT = mongodbHeartbeat({ db: DB });
const root = resolve("dist/client");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
};
const ASSETS = {
  fetch: async (request) => {
    let file = resolve(
      root,
      "." + decodeURIComponent(new URL(request.url).pathname),
    );
    if (!file.startsWith(root + "/") && !file.startsWith(root + "\\"))
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
const cmsServer = http
  .createServer(async (req, res) => {
    try {
      const chunks = [];
      let received = 0;
      for await (const c of req) {
        received += c.length;
        if (received > 51 * 1024 * 1024) {
          res.writeHead(413);
          res.end("Upload too large");
          return;
        }
        chunks.push(c);
      }
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers))
        if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
      headers.delete("oai-authenticated-user-id");
      headers.delete("oai-authenticated-user-email");
      headers.delete("x-cms-client-ip");
      const ip = clientIp(req);
      headers.set("x-cms-client-ip", ip);
      const request = new Request(
        "http://127.0.0.1:" + cmsServer.address().port + req.url,
        {
          method: req.method,
          headers,
          body: ["GET", "HEAD"].includes(req.method)
            ? undefined
            : Buffer.concat(chunks),
        },
      );
      const env = {
        DB,
        ASSETS,
        STORAGE,
        CONNECTIONS,
        AUTH,
        HEARTBEAT,
        PASSWORD_AUTH: !bypass,
      };
      let response = await handleNodeAuth(request, AUTH, ip);
      if (!response) {
        const member = bypass
          ? { id: "local-developer", email: "developer@localhost.test" }
          : await AUTH.identify(request);
        if (member) {
          headers.set("oai-authenticated-user-id", member.id);
          headers.set("oai-authenticated-user-email", member.email);
        }
        const path = new URL(request.url).pathname;
        if (!member && (path === "/admin" || path.startsWith("/admin/"))) {
          response = new Response(null, {
            status: 302,
            headers: {
              Location: (await AUTH.setupNeeded()) ? "/setup" : "/login",
              "Cache-Control": "no-store",
            },
          });
        } else
          response = await worker.fetch(new Request(request, { headers }), env);
      }
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      res.writeHead(e.status || 500, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          error: e.status
            ? e.message
            : "The server could not complete this request.",
        }),
      );
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(
      "Local: http://127.0.0.1:" + cmsServer.address().port + "/admin/",
    ),
  );
