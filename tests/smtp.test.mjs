import test from "node:test";
import assert from "node:assert/strict";
import { localDatabase } from "../scripts/local-database.mjs";
import {
  saveMailSettings,
  readMailSettings,
  validateMailSettings,
  mailDefaults,
  sendSiteMail,
} from "../server/mail.mjs";
import { smtpMailer } from "../scripts/smtp-mailer.mjs";
import worker from "../server/worker.mjs";
import { connectionManager } from "../scripts/connection-manager.mjs";
import { siteMailer } from "../scripts/site-mailer.mjs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("SMTP credentials persist in private dotenv configuration and host overrides stay protected", async () => {
  const db = localDatabase();
  try {
    const folder = await mkdtemp(join(tmpdir(), "colossal-smtp-test-"));
    const filename = join(folder, ".env.production");
    const manager = connectionManager({ filename, hostEnv: {} });
    const mail = siteMailer(db, manager);
    await mail.saveCredentials(
      { username: "account", password: "private-password" },
      false,
    );
    assert.deepEqual(await manager.mailCredentials(), {
      user: "account",
      pass: "private-password",
    });
    assert.match(await readFile(filename, "utf8"), /SMTP_PASSWORD=/);
    assert.equal((await mail.describe()).passwordConfigured, true);
    assert.equal((await mail.describe()).password, undefined);
    await mail.saveCredentials({ password: "" }, false);
    assert.equal((await manager.mailCredentials()).pass, "private-password");
    await assert.rejects(
      mail.saveCredentials({ password: "replacement" }, true),
      { status: 409 },
    );
    const hosted = siteMailer(
      db,
      connectionManager({
        filename,
        hostEnv: { SMTP_USERNAME: "host-user", SMTP_PASSWORD: "host-password" },
      }),
    );
    assert.equal((await hosted.describe()).passwordManaged, true);
    await assert.rejects(
      hosted.saveCredentials({ password: "replacement" }, false),
      /managed by your hosting/,
    );
  } finally {
    db.close();
  }
});

test("SMTP defaults to Mail2World, validates settings, and stores no credentials in config", async () => {
  const db = localDatabase();
  try {
    assert.deepEqual(await readMailSettings(db), mailDefaults);
    const settings = {
      ...mailDefaults,
      enabled: true,
      host: "smtp.example.test",
      fromEmail: "sender@example.test",
      password: "secret",
      username: "private",
    };
    await saveMailSettings(db, settings);
    const stored = (
      await db.prepare("SELECT value FROM config WHERE id='smtp'").first()
    ).value;
    assert.doesNotMatch(stored, /secret|password|username/);
    for (const invalid of [
      { port: 0 },
      { host: "https://user:secret@host/path" },
      { fromEmail: "user@example.test\r\nBcc:other@example.test" },
      { encryption: "none" },
      { fromName: "Name\nInjected" },
    ])
      assert.throws(() => validateMailSettings({ ...settings, ...invalid }));
  } finally {
    db.close();
  }
});

test("shared SMTP transport enforces TLS and sender settings, closes connections and masks errors", async () => {
  const db = localDatabase();
  let options,
    sent,
    closed = 0,
    verifies = 0;
  try {
    await saveMailSettings(db, {
      ...mailDefaults,
      enabled: true,
      host: "smtp.example.test",
      fromEmail: "sender@example.test",
      fromName: "CMS",
    });
    const mail = smtpMailer({
      db,
      credentials: async () => ({ user: "user", pass: "top-secret" }),
      transportFactory(value) {
        options = value;
        return {
          verify: async () => {
            verifies++;
          },
          sendMail: async (value) => {
            sent = value;
            return {
              accepted: ["recipient@example.test"],
              rejected: [],
              messageId: "test",
            };
          },
          close: () => closed++,
        };
      },
    });
    assert.deepEqual(await mail.verify(), { ok: true });
    assert.equal(verifies, 1);
    await sendSiteMail(
      { MAIL: mail },
      {
        to: "recipient@example.test",
        subject: "Test",
        text: "Body",
        from: "spoof@example.test",
        attachments: [{ path: "private.txt" }],
      },
    );
    assert.equal(options.requireTLS, true);
    assert.equal(options.tls.rejectUnauthorized, true);
    assert.deepEqual(sent.from, {
      name: "CMS",
      address: "sender@example.test",
    });
    assert.equal(sent.attachments, undefined);
    assert.equal(closed, 2);
    await assert.rejects(
      mail.send({
        to: "recipient@example.test",
        subject: "Bad\nHeader",
        text: "Body",
      }),
      /subject/,
    );
    const failing = smtpMailer({
      db,
      credentials: async () => ({ user: "user", pass: "secret" }),
      transportFactory: () => ({
        verify: async () => {
          throw new Error("Raw secret provider error");
        },
        close: () => closed++,
      }),
    });
    await assert.rejects(
      failing.verify(),
      (error) => error.status === 502 && !error.message.includes("Raw secret"),
    );
    assert.equal(closed, 3);
    await saveMailSettings(db, mailDefaults);
    await assert.rejects(mail.verify(), { status: 409 });
  } finally {
    db.close();
  }
});

test("SMTP settings and tests require admin and same-origin requests", async () => {
  const DB = localDatabase();
  const owner = {
    "oai-authenticated-user-id": "owner",
    "oai-authenticated-user-email": "owner@example.test",
  };
  let sends = 0;
  const env = {
    DB,
    MAIL: {
      describe: async () => ({
        available: true,
        username: "user",
        passwordConfigured: true,
      }),
      saveCredentials: async () => {},
      verify: async () => ({ ok: true }),
      send: async () => {
        sends++;
        return { ok: true };
      },
    },
  };
  const call = (path, method = "GET", body, headers = owner) =>
    worker.fetch(
      new Request("https://cms.test" + path, {
        method,
        headers: {
          Origin: "https://cms.test",
          "Content-Type": "application/json",
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
  try {
    await call("/api/admin/setup", "POST", {});
    assert.equal((await call("/api/admin/settings/smtp")).status, 200);
    assert.equal(
      (await call("/api/admin/settings/smtp", "GET", undefined, {})).status,
      401,
    );
    await DB.prepare(
      "INSERT INTO members (id,email,role) VALUES ('editor','editor@example.test','editor')",
    ).run();
    assert.equal(
      (
        await call("/api/admin/settings/smtp", "GET", undefined, {
          "oai-authenticated-user-id": "editor",
          "oai-authenticated-user-email": "editor@example.test",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          "/api/admin/settings/smtp/test",
          "POST",
          { to: "to@example.test" },
          { ...owner, Origin: "https://other.test" },
        )
      ).status,
      403,
    );
    assert.equal(sends, 0);
    assert.equal(
      (
        await call("/api/admin/settings/smtp", "POST", {
          settings: { ...mailDefaults, host: "smtp.example.test" },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/api/admin/settings/smtp/test", "POST", {
          to: "to@example.test",
        })
      ).status,
      200,
    );
    assert.equal(sends, 1);
    const read = await (await call("/api/admin/settings/smtp")).json();
    assert.equal(read.credentials.passwordConfigured, true);
    assert.equal(read.credentials.password, undefined);
  } finally {
    DB.close();
  }
});
