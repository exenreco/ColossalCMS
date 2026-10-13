import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { credentialStore } from "../server/credential-store.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { connectionManager } from "../scripts/connection-manager.mjs";
import { siteMailer } from "../scripts/site-mailer.mjs";
import { localSnapshot } from "../scripts/data-migration.mjs";
import worker from "../server/worker.mjs";
const key = "a1".repeat(32);

test("credentials are encrypted, persist across restart and bind ciphertext to the field name", async () => {
  const directory = await mkdtemp(join(tmpdir(), "colossal-credentials-"));
  const filename = join(directory, "colossal.sqlite");
  let db = localDatabase(filename);
  try {
    const store = credentialStore(db, { key });
    await store.save({
      OPENAI_API_KEY: "secret-provider-key",
      SMTP_PASSWORD: "secret-mail-password",
    });
    const rows = (await db.prepare("SELECT * FROM config").all()).results;
    assert.equal(JSON.stringify(rows).includes("secret-provider-key"), false);
    assert.equal(JSON.stringify(rows).includes("secret-mail-password"), false);
    assert.equal(
      JSON.stringify(await store.describe()).includes("secret-"),
      false,
    );
    const first = rows.find(
      (row) => row.id === "credential:OPENAI_API_KEY",
    ).value;
    await store.save({ OPENAI_API_KEY: "secret-provider-key" });
    const second = (
      await db
        .prepare("SELECT value FROM config WHERE id=?")
        .bind("credential:OPENAI_API_KEY")
        .first()
    ).value;
    assert.notEqual(JSON.parse(first).iv, JSON.parse(second).iv);
    db.close();
    db = localDatabase(filename);
    assert.equal(
      (await credentialStore(db, { key }).values()).OPENAI_API_KEY,
      "secret-provider-key",
    );
    await assert.rejects(
      credentialStore(db, { key: "b2".repeat(32) }).values(),
      /could not be decrypted/,
    );
    await assert.rejects(
      credentialStore(db).values(),
      /could not be decrypted/,
    );
    await db
      .prepare("UPDATE config SET value=? WHERE id=?")
      .bind(second, "credential:SMTP_PASSWORD")
      .run();
    await assert.rejects(
      credentialStore(db, { key }).values(),
      /could not be decrypted/,
    );
    assert.equal(
      localSnapshot(directory).config.some((row) =>
        row.id.startsWith("credential:"),
      ),
      false,
    );
  } finally {
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("missing keys fail closed; invalid input leaves every credential unchanged", async () => {
  const db = localDatabase();
  try {
    await assert.rejects(
      credentialStore(db).save({ OPENAI_API_KEY: "secret" }),
      /CMS_ENCRYPTION_KEY/,
    );
    await assert.rejects(
      credentialStore(db, { key }).save({
        OPENAI_API_KEY: "secret",
        SMTP_PASSWORD: "bad\npassword",
      }),
      /Invalid credential/,
    );
    await assert.rejects(
      credentialStore(db, { key }).save({ MONGODB_URI: "mongodb://bootstrap" }),
      /Invalid credential/,
    );
    assert.deepEqual(
      (await db.prepare("SELECT * FROM config").all()).results,
      [],
    );
  } finally {
    db.close();
  }
});

test("migration preserves existing records and environment overrides without changing the env file", async () => {
  const db = localDatabase();
  const directory = await mkdtemp(join(tmpdir(), "colossal-credential-env-"));
  const filename = join(directory, ".env.production");
  const content =
    'SMTP_USERNAME="account"\nSMTP_PASSWORD="legacy-mail"\nMONGODB_URI="mongodb://bootstrap"\n';
  await writeFile(filename, content);
  try {
    const environment = {
      OPENAI_API_KEY: "host-provider",
      CMS_ENCRYPTION_KEY: key,
    };
    const manager = connectionManager({ db, filename, hostEnv: environment });
    assert.equal((await manager.vault.migrate()).saved, 3);
    assert.equal(await readFile(filename, "utf8"), content);
    assert.equal((await manager.vault.migrate()).saved, 0);
    await assert.rejects(
      manager.save({ OPENAI_API_KEY: "replacement" }),
      /managed by your hosting/,
    );
    await assert.rejects(manager.reveal("SMTP_PASSWORD"), /never revealed/);
    const restarted = connectionManager({
      db,
      filename: join(directory, "missing.env"),
      hostEnv: { CMS_ENCRYPTION_KEY: key },
    });
    assert.equal((await restarted.config()).OPENAI_API_KEY, "host-provider");
    assert.deepEqual(await restarted.mailCredentials(), {
      user: "account",
      pass: "legacy-mail",
    });
    await restarted.save({
      OPENAI_API_KEY: "database-provider",
      CMS_STORAGE_PROVIDER: "r2",
      R2_ACCESS_KEY_ID: "r2-private",
    });
    assert.equal((await manager.config()).OPENAI_API_KEY, "host-provider");
    assert.equal(
      (await restarted.config()).OPENAI_API_KEY,
      "database-provider",
    );
    assert.equal(
      (await restarted.describe()).fields.find(
        (field) => field.key === "OPENAI_API_KEY",
      ).value,
      "",
    );
  } finally {
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("serverless AI and SMTP save database credentials; migration requires admin and same origin", async () => {
  const DB = localDatabase();
  const directory = await mkdtemp(join(tmpdir(), "colossal-credential-api-"));
  const CONNECTIONS = connectionManager({
    db: DB,
    filename: join(directory, "missing.env"),
    hostEnv: { CMS_ENCRYPTION_KEY: key },
    readOnlyBootstrap: true,
  });
  const env = {
    DB,
    CONNECTIONS,
    CREDENTIALS: CONNECTIONS.vault,
    MAIL: siteMailer(DB, CONNECTIONS),
    SERVERLESS: true,
  };
  const owner = {
    "oai-authenticated-user-id": "owner",
    "oai-authenticated-user-email": "owner@example.test",
  };
  const call = (path, body, headers = owner) =>
    worker.fetch(
      new Request("https://cms.test" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Origin: "https://cms.test",
          "Content-Type": "application/json",
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
  try {
    await call("/api/admin/setup", {});
    await DB.prepare(
      "UPDATE plugins SET active=1,installed=1 WHERE id='com.colossal.ai-assistant'",
    ).run();
    const ai = await call("/api/admin/ai-assistant/settings", {
      settings: { enabled: true, provider: "openai", maxOutputTokens: 4096 },
      keys: { openai: "encrypted-ai" },
    });
    assert.equal(ai.status, 200, await ai.text());
    const aiStatus = await (
      await call("/api/admin/ai-assistant/settings")
    ).json();
    assert.equal(
      aiStatus.providers.find((p) => p.id === "openai").readOnly,
      false,
    );
    assert.equal(JSON.stringify(aiStatus).includes("encrypted-ai"), false);
    await env.MAIL.saveCredentials(
      { username: "mail-account", password: "encrypted-mail" },
      true,
    );
    assert.equal((await CONNECTIONS.mailCredentials()).pass, "encrypted-mail");
    assert.equal((await env.MAIL.describe()).readOnly, false);
    assert.equal(
      (
        await call("/api/admin/connections/save", {
          R2_ACCESS_KEY_ID: "encrypted-storage",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/api/admin/connections/save", {
          MONGODB_URI: "mongodb://bootstrap",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call(
          "/api/admin/connections/credentials/migrate",
          {},
          { ...owner, Origin: "https://other.test" },
        )
      ).status,
      403,
    );
    await DB.prepare(
      "INSERT INTO members (id,email,role) VALUES ('editor','editor@example.test','editor')",
    ).run();
    assert.equal(
      (
        await call(
          "/api/admin/connections/credentials/migrate",
          {},
          {
            "oai-authenticated-user-id": "editor",
            "oai-authenticated-user-email": "editor@example.test",
          },
        )
      ).status,
      403,
    );
    assert.equal(
      (await call("/api/admin/connections/credentials/migrate", {})).status,
      200,
    );
    const raw = JSON.stringify(
      (await DB.prepare("SELECT * FROM config").all()).results,
    );
    assert.equal(raw.includes("encrypted-ai"), false);
    assert.equal(raw.includes("encrypted-mail"), false);
    assert.equal(raw.includes("encrypted-storage"), false);
  } finally {
    DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});
