import {
  readSeoSettings,
  validateSeoSettings,
  seoDiscovery,
  indexNowKeyFile,
  submitIndexNow,
} from "../../server/seo.mjs";
import { json, readJson } from "../../server/v2-utils.mjs";

export default {
  id: "com.colossal.seo",
  routes: [
    {
      scope: "admin",
      path: "/api/admin/seo",
      methods: ["GET", "POST"],
      admin: true,
      async handle({ request, db, log }) {
        if (request.method === "GET") return json(await readSeoSettings(db));
        const settings = validateSeoSettings(await readJson(request, 500000));
        await db
          .prepare(
            "INSERT INTO config (id,value) VALUES ('seo',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
          )
          .bind(JSON.stringify(settings))
          .run();
        await log("Updated SEO settings");
        return json({ ok: true });
      },
    },
    {
      scope: "admin",
      path: "/api/admin/seo/index",
      methods: ["POST"],
      async handle({ request, db, log }) {
        const body = await readJson(request, 500000);
        const result = await submitIndexNow(db, request, body.contentId);
        await log(`IndexNow submitted ${result.url} (HTTP ${result.status})`);
        return json(result);
      },
    },
    ...["/robots.txt", "/sitemap.xml"].map((path) => ({
      scope: "public",
      path,
      methods: ["GET", "HEAD"],
      async handle({ request, database }) {
        const discovery = await seoDiscovery(database(), request);
        return discovery
          ? new Response(request.method === "HEAD" ? null : discovery.body, {
              status: discovery.status,
              headers: discovery.headers,
            })
          : null;
      },
    })),
    {
      scope: "public",
      pattern: "^/[a-zA-Z0-9-]{8,128}\\.txt$",
      methods: ["GET", "HEAD"],
      async handle({ request, path, database }) {
        const key = await indexNowKeyFile(database(), path);
        return key
          ? new Response(request.method === "HEAD" ? null : key.body, {
              headers: key.headers,
            })
          : null;
      },
    },
  ],
};
