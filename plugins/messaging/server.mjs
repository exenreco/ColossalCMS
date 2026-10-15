import { json, readJson, parse, all, fail } from "../../server/v2-utils.mjs";
import { readMailSettings, sendSiteMail } from "../../server/mail.mjs";
import {
  MESSAGING_ID,
  defaults,
  validateSettings,
  validateSubmission,
  formHash,
} from "./config.mjs";
export async function readMessagingSettings(db) {
  return validateSettings({
    ...defaults,
    ...parse(
      (
        await db
          .prepare("SELECT value FROM config WHERE id='messaging'")
          .first()
      )?.value,
    ),
  });
}
async function active(db) {
  const row = await db
    .prepare("SELECT active,installed FROM plugins WHERE id=?")
    .bind(MESSAGING_ID)
    .first();
  const settings = await readMessagingSettings(db);
  if (!row?.active || !row?.installed || !settings.enabled)
    fail("Messaging is currently unavailable.", 404);
  return settings;
}
const formRequests = new Map();
function limit(request) {
  const ip =
    request.headers.get("x-cms-client-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown";
  const now = Date.now();
  for (const [key, value] of formRequests)
    if (value.time < now - 60000) formRequests.delete(key);
  const entry = formRequests.get(ip) || { time: now, count: 0 };
  if (++entry.count > 30)
    fail("Please wait a minute before requesting another form.", 429);
  if (formRequests.size > 10000)
    formRequests.delete(formRequests.keys().next().value);
  formRequests.set(ip, entry);
}
async function notify(db, env, settings, message) {
  let status = "disabled";
  if (settings.notify) {
    try {
      const smtp = await readMailSettings(db);
      const to = settings.recipient || smtp.fromEmail;
      status = !smtp.enabled || !to ? "not-configured" : "failed";
      if (smtp.enabled && to) {
        await sendSiteMail(env, {
          to,
          subject:
            "New website message: " +
            (message.sender_name || "Visitor")
              .replace(/[\r\n]/g, " ")
              .slice(0, 120),
          text: [
            "A new message was received through your website.",
            "",
            ...parse(message.fields, []).map(
              (field) => field.label + ": " + field.value,
            ),
            "",
            "Source: " + message.source_path,
            "Message ID: " + message.id,
          ].join("\n"),
        });
        status = "sent";
      }
    } catch {
      status = "failed";
    }
  }
  await db
    .prepare(
      "UPDATE messaging_messages SET notification_status=?,updated_at=? WHERE id=?",
    )
    .bind(status, new Date().toISOString(), message.id)
    .run();
  return status;
}
export default {
  id: MESSAGING_ID,
  routes: [
    {
      scope: "public",
      path: "/api/messaging/form",
      methods: ["GET"],
      async handle({ request, database }) {
        limit(request);
        const db = database(),
          settings = await active(db),
          token = crypto.randomUUID(),
          now = new Date().toISOString();
        await db
          .prepare("DELETE FROM messaging_tokens WHERE expires_at<?")
          .bind(now)
          .run();
        await db
          .prepare(
            "INSERT INTO messaging_tokens(id,form_hash,expires_at) VALUES (?,?,?)",
          )
          .bind(
            token,
            await formHash(settings.fields),
            new Date(Date.now() + 1800000).toISOString(),
          )
          .run();
        return json({
          title: settings.title,
          description: settings.description,
          submitLabel: settings.submitLabel,
          successMessage: settings.successMessage,
          fields: settings.fields,
          token,
        });
      },
    },
    {
      scope: "public",
      path: "/api/messaging/submit",
      methods: ["POST"],
      async handle({ request, database, env }) {
        const url = new URL(request.url);
        if (request.headers.get("Origin") !== url.origin)
          fail("Messages must be submitted from this website.", 403);
        const db = database(),
          settings = await active(db),
          body = await readJson(request, 40000);
        if (body.website)
          return json({ ok: true, message: settings.successMessage });
        if (
          typeof body.token !== "string" ||
          !/^[a-f0-9-]{36}$/.test(body.token)
        )
          fail("Reload the form and try again.", 400);
        if (
          await db
            .prepare("SELECT id FROM messaging_messages WHERE id=?")
            .bind(body.token)
            .first()
        )
          return json({ ok: true, message: settings.successMessage });
        const token = await db
          .prepare("SELECT * FROM messaging_tokens WHERE id=?")
          .bind(body.token)
          .first();
        if (
          !token ||
          token.expires_at < new Date().toISOString() ||
          token.form_hash !== (await formHash(settings.fields))
        )
          fail(
            "The form has expired or changed. Reload it and try again.",
            409,
          );
        const fields = validateSubmission(settings.fields, body.values),
          time = new Date().toISOString();
        const claimed = await db
          .prepare("DELETE FROM messaging_tokens WHERE id=? AND expires_at>=?")
          .bind(body.token, time)
          .run();
        if (Number(claimed.meta?.changes ?? claimed.changes) !== 1)
          fail(
            "This form was already submitted. Reload it to send another message.",
            409,
          );
        const path =
          typeof body.sourcePath === "string" &&
          /^\/(?!\/)/.test(body.sourcePath)
            ? body.sourcePath.slice(0, 500)
            : "";
        const name =
            fields.find((field) => field.key === "name")?.value || "Visitor",
          email = fields.find((field) => field.type === "email")?.value || "";
        const message = {
          id: body.token,
          sender_name: name.slice(0, 200),
          sender_email: email,
          subject: (
            fields.find((field) => field.key === "subject")?.value ||
            "Website message"
          ).slice(0, 200),
          fields: JSON.stringify(fields),
          source_path: path,
        };
        await db
          .prepare(
            "INSERT INTO messaging_messages(id,sender_name,sender_email,subject,fields,status,notification_status,source_path,created_at,updated_at) VALUES (?,?,?,?,?,'unread','pending',?,?,?)",
          )
          .bind(
            message.id,
            message.sender_name,
            message.sender_email,
            message.subject,
            message.fields,
            path,
            time,
            time,
          )
          .run();
        await notify(db, env, settings, message);
        return json({ ok: true, message: settings.successMessage }, 201);
      },
    },
    {
      scope: "admin",
      prefix: "/api/admin/messaging",
      methods: ["GET", "POST"],
      admin: true,
      async handle({ request, db, env, path, log }) {
        if (path === "/api/admin/messaging/count" && request.method === "GET") {
          const row = await db
            .prepare(
              "SELECT COUNT(*) AS count FROM messaging_messages WHERE status <> 'trash'",
            )
            .first();
          return json({ count: Number(row?.count || 0) });
        }
        if (path === "/api/admin/messaging/settings") {
          if (request.method === "GET")
            return json({
              settings: await readMessagingSettings(db),
              smtp: await readMailSettings(db),
            });
          const settings = validateSettings(await readJson(request, 25000));
          await db
            .prepare(
              "INSERT INTO config(id,value) VALUES ('messaging',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
            )
            .bind(JSON.stringify(settings))
            .run();
          await log("Updated Messaging form settings");
          return json({ ok: true });
        }
        if (
          path === "/api/admin/messaging/messages" &&
          request.method === "GET"
        ) {
          const query = new URL(request.url).searchParams,
            status = query.get("status") || "all",
            page = Math.max(1, Number(query.get("page")) || 1);
          if (
            !["all", "unread", "read", "archived", "trash"].includes(status) ||
            !Number.isInteger(page) ||
            page > 10000
          )
            fail("Choose a valid inbox filter.");
          const where = status === "all" ? "status <> 'trash'" : "status=?",
            args = status === "all" ? [] : [status];
          const rows = await all(
            db,
            "SELECT * FROM messaging_messages WHERE " +
              where +
              " ORDER BY created_at DESC LIMIT 50 OFFSET ?",
            ...args,
            (page - 1) * 50,
          );
          const total =
            (
              await db
                .prepare(
                  "SELECT COUNT(*) AS total FROM messaging_messages WHERE " +
                    where,
                )
                .bind(...args)
                .first()
            )?.total || 0;
          return json({
            messages: rows.map((row) => ({
              ...row,
              fields: parse(row.fields, []),
            })),
            total,
            page,
          });
        }
        if (path === "/api/admin/messaging/bulk" && request.method === "POST") {
          const body = await readJson(request, 25000),
            actions = {
              read: "read",
              unread: "unread",
              archive: "archived",
              trash: "trash",
              restore: "unread",
            };
          if (
            !Array.isArray(body.ids) ||
            !body.ids.length ||
            body.ids.length > 100 ||
            body.ids.some((id) => typeof id !== "string" || id.length > 100) ||
            ![...Object.keys(actions), "retry-email"].includes(body.action)
          )
            fail("Choose up to 100 messages and a valid action.");
          const ids = [...new Set(body.ids)];
          if (body.action === "retry-email" && ids.length > 5)
            fail("Select up to 5 messages when retrying email notifications.");
          let updated = 0;
          if (body.action === "retry-email") {
            const settings = await readMessagingSettings(db);
            for (const id of ids) {
              const row = await db
                .prepare("SELECT * FROM messaging_messages WHERE id=?")
                .bind(id)
                .first();
              if (
                row &&
                row.status !== "trash" &&
                row.notification_status !== "sent"
              ) {
                await notify(db, env, settings, row);
                updated++;
              }
            }
          } else {
            const results = await db.batch(
              ids.map((id) =>
                db
                  .prepare(
                    "UPDATE messaging_messages SET status=?,updated_at=? WHERE id=?",
                  )
                  .bind(actions[body.action], new Date().toISOString(), id),
              ),
            );
            updated = results.reduce(
              (sum, result) =>
                sum + Number(result.meta?.changes ?? result.changes),
              0,
            );
          }
          await log(
            "Messaging bulk action: " +
              body.action +
              " (" +
              updated +
              " messages)",
          );
          return json({ ok: true, updated });
        }
        fail("Messaging operation not found.", 404);
      },
    },
  ],
};
