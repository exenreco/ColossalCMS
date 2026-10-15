import test from "node:test";
import assert from "node:assert/strict";
import { localDatabase } from "../scripts/local-database.mjs";
import {
  defaults,
  validateSettings,
  validateSubmission,
} from "../plugins/messaging/config.mjs";
import messaging from "../plugins/messaging/server.mjs";
import { createPluginRegistry } from "../server/plugin-registry.mjs";
import { colossal2027Theme } from "../server/colossal-2027.mjs";
import { renderTheme } from "../server/theme-engine.mjs";
import { parseSql, mongoAdapter } from "../scripts/mongo-database.mjs";

test("Messaging validates configured field types, choices, required values and safe email addresses", () => {
  assert.equal(validateSettings(defaults).fields.length, 3);
  assert.throws(
    () =>
      validateSettings({
        ...defaults,
        fields: [...defaults.fields, defaults.fields[0]],
      }),
    /unique/,
  );
  assert.throws(
    () => validateSettings({ ...defaults, recipient: "bad\r\n@example.com" }),
    /email/,
  );
  assert.throws(
    () =>
      validateSubmission(defaults.fields, {
        name: "Name",
        email: "not email",
        message: "Hi",
      }),
    /email/,
  );
  assert.throws(
    () =>
      validateSubmission(defaults.fields, {
        name: "Name",
        email: "john@example.com",
      }),
    /required/,
  );
  assert.throws(
    () =>
      validateSubmission(defaults.fields, {
        name: "Name",
        email: "john@example.com",
        message: "Hi",
        unknown: "extra",
      }),
    /fields/,
  );
  const fields = [
    {
      key: "choice",
      label: "Topic",
      type: "select",
      required: true,
      options: ["Project", "Question"],
    },
    { key: "consent", label: "Consent", type: "checkbox", required: true },
  ];
  assert.throws(
    () => validateSubmission(fields, { choice: "Other", consent: true }),
    /available option/,
  );
  assert.throws(
    () => validateSubmission(fields, { choice: "Project", consent: false }),
    /required/,
  );
  assert.equal(
    validateSubmission(fields, { choice: "Project", consent: true })[1].value,
    "Yes",
  );
});
test("Messaging saves before SMTP, checks form tokens, deduplicates retries, and supports reversible admin bulk actions", async () => {
  const db = localDatabase(),
    registry = createPluginRegistry([messaging]);
  const calls = [];
  let failMail = false;
  const env = {
    MAIL: {
      send: async (message) => {
        calls.push(message);
        assert.ok(
          await db
            .prepare("SELECT id FROM messaging_messages WHERE id=?")
            .bind(latestToken)
            .first(),
        );
        if (failMail) throw new Error("Private SMTP failure");
        return { ok: true };
      },
    },
  };
  let latestToken = "";
  const req = async (path, body, user) =>
    registry.dispatch(user ? "admin" : "public", {
      path,
      db,
      database: () => db,
      env,
      user,
      log: async () => {},
      request: new Request(
        "https://cms.test" + path,
        body
          ? {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Origin: "https://cms.test",
              },
              body: JSON.stringify(body),
            }
          : {},
      ),
    });
  try {
    await db
      .prepare(
        "INSERT INTO plugins(id,active,installed) VALUES ('com.colossal.messaging',1,1)",
      )
      .run();
    await db
      .prepare("INSERT INTO config(id,value) VALUES ('smtp',?)")
      .bind(
        JSON.stringify({
          enabled: true,
          provider: "custom",
          host: "smtp.example.com",
          port: 587,
          encryption: "starttls",
          fromEmail: "sender@example.com",
          fromName: "Site",
          replyTo: "",
        }),
      )
      .run();
    await req(
      "/api/admin/messaging/settings",
      { ...defaults, recipient: "inbox@example.com" },
      { role: "admin" },
    );
    const form = await (await req("/api/messaging/form")).json();
    latestToken = form.token;
    assert.equal(form.fields.length, 3);
    assert.equal(form.recipient, undefined);
    const body = {
      token: form.token,
      values: {
        name: "Visitor",
        email: "john@example.com",
        message: "Test message",
      },
      sourcePath: "/contact",
    };
    assert.equal((await req("/api/messaging/submit", body)).status, 201);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].to, "inbox@example.com");
    assert.match(calls[0].text, /Test message/);
    assert.equal((await req("/api/messaging/submit", body)).status, 200);
    assert.equal(calls.length, 1);
    const saved = await db
      .prepare("SELECT * FROM messaging_messages WHERE id=?")
      .bind(form.token)
      .first();
    assert.equal(saved.notification_status, "sent");
    assert.equal(saved.status, "unread");
    assert.equal(
      (
        await (
          await req("/api/admin/messaging/count", null, { role: "admin" })
        ).json()
      ).count,
      1,
    );
    for (const [action, status] of [
      ["read", "read"],
      ["archive", "archived"],
      ["trash", "trash"],
      ["restore", "unread"],
    ]) {
      await req(
        "/api/admin/messaging/bulk",
        { action, ids: [form.token] },
        { role: "admin" },
      );
      assert.equal(
        (
          await db
            .prepare("SELECT status FROM messaging_messages WHERE id=?")
            .bind(form.token)
            .first()
        ).status,
        status,
      );
      assert.equal(
        (
          await (
            await req("/api/admin/messaging/count", null, { role: "admin" })
          ).json()
        ).count,
        status === "trash" ? 0 : 1,
      );
    }
    const inbox = await (
      await req("/api/admin/messaging/messages", null, { role: "admin" })
    ).json();
    assert.equal(inbox.total, 1);
    assert.equal(inbox.messages[0].fields[2].value, "Test message");
    const second = await (await req("/api/messaging/form")).json();
    latestToken = second.token;
    failMail = true;
    const response = await req("/api/messaging/submit", {
      ...body,
      token: second.token,
    });
    assert.equal(response.status, 201);
    assert.equal(
      (
        await db
          .prepare(
            "SELECT notification_status FROM messaging_messages WHERE id=?",
          )
          .bind(second.token)
          .first()
      ).notification_status,
      "failed",
    );
    assert.doesNotMatch(JSON.stringify(await response.json()), /Private SMTP/);
    await assert.rejects(
      req("/api/admin/messaging/messages", null, { role: "editor" }),
      /Administrator/,
    );
    await assert.rejects(
      req("/api/admin/messaging/count", null, { role: "editor" }),
      /Administrator/,
    );
    const expired = await (await req("/api/messaging/form")).json();
    await db
      .prepare("UPDATE messaging_tokens SET expires_at=? WHERE id=?")
      .bind("2000-01-01", expired.token)
      .run();
    await assert.rejects(
      req("/api/messaging/submit", { ...body, token: expired.token }),
      /expired/,
    );
  } finally {
    db.close();
  }
});
test("Messaging submissions enforce origin, honeypot and activation without exposing inbox data", async () => {
  const db = localDatabase(),
    registry = createPluginRegistry([messaging]);
  try {
    await db
      .prepare(
        "INSERT INTO plugins(id,active,installed) VALUES ('com.colossal.messaging',1,1)",
      )
      .run();
    const dispatch = (origin) =>
      registry.dispatch("public", {
        path: "/api/messaging/submit",
        database: () => db,
        env: {},
        request: new Request("https://cms.test/api/messaging/submit", {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body: JSON.stringify({ website: "spam" }),
        }),
      });
    await assert.rejects(dispatch("https://other.test"), /this website/);
    assert.equal((await dispatch("https://cms.test")).status, 200);
    assert.equal(
      (
        await db
          .prepare("SELECT COUNT(*) AS total FROM messaging_messages")
          .first()
      ).total,
      0,
    );
    await db.prepare("UPDATE plugins SET active=0").run();
    await assert.rejects(dispatch("https://cms.test"), /unavailable/);
  } finally {
    db.close();
  }
});
test("Glossy Contact uses the plugin-owned Message form and shared Sidebar with safe preview markup", () => {
  const d = colossal2027Theme();
  assert.equal(
    d.manifest.templates.find((t) => t.id === "contact").name,
    "Contact",
  );
  const result = renderTheme(
    d,
    {
      kind: "page",
      content: {
        id: "contact",
        title: "Contact",
        body: "Authored introduction",
        details: {},
      },
      settings: {},
      allContent: [],
      media: [],
      plugins: [{ id: "com.colossal.messaging" }],
    },
    "contact",
  );
  assert.match(result.html, /cl-messaging-columns-2/);
  assert.match(result.html, /theme-part-sidebar/);
  assert.match(result.html, /Authored introduction/);
  assert.doesNotMatch(result.html, /<script/);
});
test("MongoDB inbox SQL supports counting and paginated reads", async () => {
  const q = parseSql(
    "SELECT * FROM messaging_messages WHERE status <> 'trash' ORDER BY created_at DESC LIMIT 50 OFFSET ?",
    [50],
  );
  assert.equal(q.offset, 50);
  assert.equal(
    parseSql(
      "SELECT COUNT(*) AS total FROM messaging_messages WHERE status=?",
      ["unread"],
    ).aggregate.countAlias,
    "total",
  );
  assert.throws(
    () => parseSql("SELECT * FROM messaging_messages LIMIT 50 OFFSET ?", [-1]),
    /offset/,
  );
  let skipped = 0,
    limited = 0;
  const cursor = {
    sort() {
      return this;
    },
    skip(n) {
      skipped = n;
      return this;
    },
    limit(n) {
      limited = n;
      return this;
    },
    async toArray() {
      return [{ id: "message" }];
    },
  };
  const db = mongoAdapter(
    {},
    {
      collection: () => ({
        find: () => cursor,
        countDocuments: async () => 51,
      }),
    },
  );
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) AS total FROM messaging_messages")
        .first()
    ).total,
    51,
  );
  await db
    .prepare(
      "SELECT * FROM messaging_messages ORDER BY created_at DESC LIMIT 50 OFFSET ?",
    )
    .bind(50)
    .all();
  assert.equal(skipped, 50);
  assert.equal(limited, 50);
});
