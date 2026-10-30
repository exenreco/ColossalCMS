import {
  createPlayService,
  ID,
  PlayError,
  readBody,
  readiness,
} from "./service.mjs";
const service = createPlayService();
const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function settings(db) {
  const row = await db
    .prepare("SELECT value FROM config WHERE id='media-manager-play'")
    .first();
  try {
    return { enabled: JSON.parse(row?.value || "{}").enabled === true };
  } catch {
    return { enabled: false };
  }
}
async function publicHandler(context, type) {
  try {
    if (new URL(context.request.url).protocol !== "https:")
      throw new PlayError("HTTPS is required.", 400);
    const db = context.database();
    const plugin = await db
      .prepare("SELECT installed,active FROM plugins WHERE id=?")
      .bind(ID)
      .first();
    if (!plugin?.installed || !plugin?.active || !(await settings(db)).enabled)
      throw new PlayError("Purchase verification is disabled.", 503);
    const config = context.env.MEDIA_MANAGER_PLAY || {};
    if (type === "verify")
      return json(
        await service.verify(await readBody(context.request), config),
      );
    return json(
      await service.notification(
        context.request,
        () => readBody(context.request),
        config,
      ),
    );
  } catch (error) {
    // Never leak Google responses, purchase tokens, receipts, or credentials.
    return json(
      {
        error:
          error instanceof PlayError
            ? error.message
            : "Purchase verification is temporarily unavailable.",
      },
      error instanceof PlayError ? error.status : 503,
    );
  }
}
export default {
  id: ID,
  routes: [
    {
      scope: "public",
      path: "/api/media-manager/play/verify",
      methods: ["POST"],
      handle: (context) => publicHandler(context, "verify"),
    },
    {
      scope: "public",
      path: "/api/media-manager/play/notifications",
      methods: ["POST"],
      handle: (context) => publicHandler(context, "notification"),
    },
    {
      scope: "admin",
      path: "/api/admin/media-manager-play",
      methods: ["GET", "POST"],
      admin: true,
      async handle({ request, db, env, log }) {
        if (request.method === "POST") {
          const input = await readBody(request);
          if (
            typeof input.enabled !== "boolean" ||
            Object.keys(input).some((key) => key !== "enabled")
          )
            return json({ error: "Choose enabled or disabled." }, 400);
          const ready = readiness(env.MEDIA_MANAGER_PLAY);
          if (
            input.enabled &&
            (!ready.identityConfigured || !ready.receiptKeyConfigured)
          )
            return json(
              {
                error:
                  "Configure the hosting identity and licensing public key first.",
              },
              400,
            );
          await db
            .prepare(
              "INSERT INTO config (id,value) VALUES ('media-manager-play',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
            )
            .bind(JSON.stringify({ enabled: input.enabled }))
            .run();
          await log("Updated Media Manager Play verification availability");
        }
        return json({
          ...(await settings(db)),
          ...readiness(env.MEDIA_MANAGER_PLAY),
          verifyUrl: new URL("/api/media-manager/play/verify", request.url)
            .href,
          notificationsUrl: new URL(
            "/api/media-manager/play/notifications",
            request.url,
          ).href,
        });
      },
    },
  ],
};
