import { json, readJson, parse } from "../../server/v2-utils.mjs";
import { LAZY_LOAD_ID, defaults, validateSettings } from "./config.mjs";
import { decorateImages } from "./renderer.mjs";
export async function readLazyLoadSettings(db) {
  return validateSettings({
    ...defaults,
    ...parse(
      (
        await db
          .prepare("SELECT value FROM config WHERE id='lazy-load'")
          .first()
      )?.value,
    ),
  });
}
export default {
  id: LAZY_LOAD_ID,
  routes: [
    {
      scope: "admin",
      path: "/api/admin/lazy-load",
      methods: ["GET", "POST"],
      admin: true,
      async handle({ request, db, log }) {
        if (request.method === "GET")
          return json(await readLazyLoadSettings(db));
        const settings = validateSettings(await readJson(request, 4096));
        await db
          .prepare(
            "INSERT INTO config (id,value) VALUES ('lazy-load',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
          )
          .bind(JSON.stringify(settings))
          .run();
        await log("Updated Lazy Load settings");
        return json({ ok: true });
      },
    },
  ],
  async transformRender(rendered, { database }) {
    if (rendered.preview) return rendered;
    const db = database();
    const plugin = await db
      .prepare("SELECT installed,active FROM plugins WHERE id=?")
      .bind(LAZY_LOAD_ID)
      .first();
    if (!plugin?.installed || !plugin?.active) return rendered;
    return decorateImages(rendered, await readLazyLoadSettings(db));
  },
};
