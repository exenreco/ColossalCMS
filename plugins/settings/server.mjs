import {
  readMailSettings,
  saveMailSettings,
  validateMailSettings,
  mailAddress,
  sendSiteMail,
} from "../../server/mail.mjs";
import { readJson, json, fail } from "../../server/v2-utils.mjs";

export default {
  id: "com.colossal.settings",
  routes: [
    {
      scope: "admin",
      prefix: "/api/admin/settings/smtp",
      methods: ["GET", "POST"],
      admin: true,
      async handle({ request, env, db, path, user, log }) {
        if (path === "/api/admin/settings/smtp" && request.method === "GET")
          return json({
            settings: await readMailSettings(db),
            credentials: env.MAIL
              ? {
                  ...(await env.MAIL.describe()),
                  readOnly: env.CONNECTIONS?.vault
                    ? !env.CONNECTIONS.vault.writable()
                    : !!env.SERVERLESS,
                }
              : {
                  available: false,
                  readOnly: true,
                  username: "",
                  passwordConfigured: false,
                },
          });
        const body = await readJson(request, 20000);
        if (path === "/api/admin/settings/smtp" && request.method === "POST") {
          validateMailSettings(body.settings);
          if (body.username !== undefined || body.password) {
            if (!env.MAIL)
              fail("SMTP credentials require the Node hosting adapter.", 503);
            await env.MAIL.saveCredentials(
              { username: body.username, password: body.password },
              env.SERVERLESS,
            );
          }
          await saveMailSettings(db, body.settings);
          await log("Updated SMTP settings");
          return json({ ok: true });
        }
        if (
          path === "/api/admin/settings/smtp/verify" &&
          request.method === "POST"
        ) {
          if (!env.MAIL) fail("SMTP requires the Node hosting adapter.", 503);
          return json(await env.MAIL.verify());
        }
        if (
          path === "/api/admin/settings/smtp/test" &&
          request.method === "POST"
        ) {
          const to = mailAddress(body.to || user.email);
          const result = await sendSiteMail(env, {
            to,
            subject: "Colossal CMS SMTP test",
            text: "Your shared SMTP configuration is working. Plugins can send mail using this service.",
          });
          await log("Sent SMTP test message");
          return json(result);
        }
        fail("SMTP operation not found.", 404);
      },
    },
  ],
};
