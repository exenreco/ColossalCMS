import {
  readAdSettings,
  validateAdSettings,
  adVerification,
} from "../../server/google-ads.mjs";
import { json, readJson } from "../../server/v2-utils.mjs";

export default {
  id: "com.colossal.google-ads",
  routes: [
    {
      scope: "admin",
      path: "/api/admin/google-ads",
      methods: ["GET", "POST"],
      admin: true,
      async handle({ request, db, log }) {
        if (request.method === "GET") return json(await readAdSettings(db));
        const settings = validateAdSettings(await readJson(request, 500000));
        await db
          .prepare(
            "INSERT INTO config (id,value) VALUES ('google-ads',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
          )
          .bind(JSON.stringify(settings))
          .run();
        await log("Updated Google Ads settings");
        return json({ ok: true });
      },
    },
    {
      scope: "public",
      path: "/ads.txt",
      methods: ["GET", "HEAD"],
      async handle({ request, database }) {
        const { adsTxt } = await adVerification(database());
        return new Response(
          request.method === "HEAD"
            ? null
            : adsTxt ||
                "ads.txt is disabled or no AdSense publisher is configured.\n",
          {
            status: adsTxt ? 200 : 404,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            },
          },
        );
      },
    },
  ],
  async metadata({ database }) {
    const { publisher } = await adVerification(database());
    return publisher
      ? `<meta name="google-adsense-account" content="${publisher}">`
      : "";
  },
};
