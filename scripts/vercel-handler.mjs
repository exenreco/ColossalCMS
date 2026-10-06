import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import worker from "../server/worker.mjs";
import { productionRuntime } from "./production-server.mjs";
import { handleNodeAuth } from "./node-auth.mjs";
import {
  connectionFailure,
  connectionErrorFacts,
} from "./connection-errors.mjs";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

// Keep clients alive across warm requests; retry initialization after a failure.
export function createVercelHandler(
  config = process.env,
  runtimeFactory = productionRuntime,
  logError = console.error,
) {
  let runtime;
  const getRuntime = async () => {
    if (!runtime) {
      runtime = Promise.resolve()
        .then(async () => {
          if (config.CMS_STORAGE_PROVIDER === "local")
            throw Object.assign(
              new Error("Vercel requires GridFS or R2-compatible storage."),
              {
                code: "CMS_SERVERLESS_STORAGE",
              },
            );
          const env = await runtimeFactory(config);
          env.SERVERLESS = true;
          const root = resolve("dist/client");
          env.ASSETS = {
            fetch: async (request) => {
              const path = new URL(request.url).pathname;
              const file = resolve(root, "." + decodeURIComponent(path));
              if (!file.startsWith(root + sep))
                return new Response("Forbidden", { status: 403 });
              try {
                return new Response(await readFile(file), {
                  headers: {
                    "Content-Type":
                      types[extname(file)] || "application/octet-stream",
                  },
                });
              } catch {
                return new Response("Not found", { status: 404 });
              }
            },
          };
          return env;
        })
        .catch((error) => {
          runtime = undefined;
          throw error;
        });
    }
    return runtime;
  };
  return async (req, res) => {
    try {
      let origin;
      try {
        origin = new URL(config.CMS_PUBLIC_URL || "");
      } catch {
        throw Object.assign(
          new Error("Configure the exact HTTPS CMS_PUBLIC_URL."),
          {
            code: "CMS_PUBLIC_URL_INVALID",
          },
        );
      }
      if (
        origin.protocol !== "https:" ||
        origin.pathname !== "/" ||
        origin.search ||
        origin.hash ||
        origin.username ||
        origin.password
      )
        throw Object.assign(
          new Error("Configure the exact HTTPS CMS_PUBLIC_URL."),
          {
            code: "CMS_PUBLIC_URL_INVALID",
          },
        );
      const incoming = new URL(req.url, origin);
      if (incoming.origin !== origin.origin)
        throw Object.assign(new Error("Invalid request origin."), {
          status: 400,
        });
      const path = incoming.searchParams.get("__cmsPath") || incoming.pathname;
      incoming.searchParams.delete("__cmsPath");
      // Never allow a rewritten path to replace the configured site origin.
      if (
        !path.startsWith("/") ||
        path.startsWith("//") ||
        path.includes("\\") ||
        path.includes("?") ||
        path.includes("#")
      )
        throw Object.assign(new Error("Invalid request path."), {
          status: 400,
        });
      incoming.pathname = path;
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers))
        if (value)
          headers.set(key, Array.isArray(value) ? value.join(",") : value);
      headers.delete("oai-authenticated-user-id");
      headers.delete("oai-authenticated-user-email");
      let body;
      if (!["GET", "HEAD"].includes(req.method)) {
        if (req.body !== undefined && req.body !== null) {
          body =
            Buffer.isBuffer(req.body) || typeof req.body === "string"
              ? req.body
              : JSON.stringify(req.body);
        } else {
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 4.5 * 1024 * 1024)
              throw Object.assign(
                new Error("Upload exceeds the Vercel request limit."),
                { status: 413 },
              );
            chunks.push(chunk);
          }
          body = Buffer.concat(chunks);
        }
        if (Buffer.byteLength(body) > 4.5 * 1024 * 1024)
          throw Object.assign(
            new Error("Upload exceeds the Vercel request limit."),
            { status: 413 },
          );
      }
      const request = new Request(incoming, {
        method: req.method,
        headers,
        body,
      });
      const env = await getRuntime();
      let response = await handleNodeAuth(
        request,
        env.AUTH,
        req.socket?.remoteAddress || "unknown",
      );
      if (path === "/healthz") response = Response.json({ ok: true });
      if (!response) {
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
      // Dynamic CMS and auth responses must never be stored by the CDN.
      res.writeHead(response.status, {
        ...Object.fromEntries(response.headers),
        "Cache-Control": "no-store",
      });
      res.end(
        req.method === "HEAD"
          ? undefined
          : Buffer.from(await response.arrayBuffer()),
      );
    } catch (error) {
      // Fixed diagnoses only: never log a raw error, URI, stack or credentials.
      if (!error.status) {
        logError("CMS startup/request failed: " + connectionFailure(error));
        logError(
          "CMS connection diagnostics: " +
            JSON.stringify(connectionErrorFacts(error)),
        );
      }
      res.writeHead(error.status || 503, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          error: error.status
            ? error.message
            : "CMS unavailable. Check Vercel environment variables and provider access.",
        }),
      );
    }
  };
}
