import test from "node:test";
import assert from "node:assert/strict";
import { credentialStore } from "../server/credential-store.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import {
  readConfiguration,
  credentialFields,
  credentialStatus,
} from "../plugins/media-manager-play/configuration.mjs";
import plugin from "../plugins/media-manager-play/server.mjs";
import { createPluginRegistry } from "../server/plugin-registry.mjs";
const masterKey = "d4".repeat(32);
const rsa = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-1",
  },
  true,
  ["sign", "verify"],
);
const values = {
  publicKey: Buffer.from(
    await crypto.subtle.exportKey("spki", rsa.publicKey),
  ).toString("base64"),
  audience:
    "//iam.googleapis.com/projects/12345/locations/global/workloadIdentityPools/cms/providers/vercel",
  serviceAccount:
    "media-manager-play-verifier@portfolio-457414.iam.gserviceaccount.com",
};
function setup(key = masterKey, environment = {}) {
  const db = localDatabase();
  const env = {
    CREDENTIALS: credentialStore(db, { key, environment }),
    MEDIA_MANAGER_PLAY: { identityToken: () => "host-token" },
  };
  const registry = createPluginRegistry([plugin]);
  async function request(input, user = { role: "admin" }) {
    const response = await registry.dispatch("admin", {
      path: "/api/admin/media-manager-play",
      db,
      env,
      user,
      log: async () => {},
      request: new Request(
        "https://cms.test/api/admin/media-manager-play",
        input === undefined
          ? {}
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(input),
            },
      ),
    });
    return { response, body: await response.json() };
  }
  return { db, env, request };
}
test("all three inputs are encrypted, masked in every response and restored from database", async () => {
  const h = setup();
  try {
    const saved = await h.request({ enabled: true, credentials: values });
    assert.equal(saved.response.status, 200);
    const rows = (await h.db.prepare("SELECT * FROM config").all()).results;
    for (const [field, name] of Object.entries(credentialFields)) {
      const record = rows.find((row) => row.id === "credential:" + name);
      assert.equal(JSON.parse(record.value).alg, "AES-256-GCM");
      assert.equal(JSON.stringify(rows).includes(values[field]), false);
      assert.equal(JSON.stringify(saved.body).includes(values[field]), false);
      assert.equal(saved.body.credentials[field].source, "database");
    }
    const reloaded = {
      ...h.env,
      CREDENTIALS: credentialStore(h.db, { key: masterKey }),
    };
    const config = await readConfiguration(reloaded);
    for (const field of Object.keys(values))
      assert.equal(config[field], values[field]);
    assert.equal(saved.body.identityConfigured, true);
    assert.equal(saved.body.receiptKeyConfigured, true);
    const get = await h.request();
    for (const value of Object.values(values))
      assert.equal(JSON.stringify(get.body).includes(value), false);
    const raw = JSON.stringify(rows);
    await h.request({
      enabled: true,
      credentials: { publicKey: "", audience: "", serviceAccount: "" },
    });
    assert.equal(
      JSON.stringify(
        (await h.db.prepare("SELECT * FROM config").all()).results,
      ),
      raw,
    );
  } finally {
    h.db.close();
  }
});
test("invalid replacements do not partially update valid credentials or enabled state", async () => {
  const h = setup();
  try {
    await h.request({ enabled: false, credentials: values });
    const before = JSON.stringify(
      (await h.db.prepare("SELECT * FROM config").all()).results,
    );
    for (const credentials of [
      { publicKey: "bad", audience: values.audience },
      { serviceAccount: "attacker@example.com" },
      { audience: "https://evil.test" },
      { publicKey: values.publicKey, privateKey: "not-allowed" },
    ]) {
      await assert.rejects(() => h.request({ enabled: true, credentials }));
      assert.equal(
        JSON.stringify(
          (await h.db.prepare("SELECT * FROM config").all()).results,
        ),
        before,
      );
    }
  } finally {
    h.db.close();
  }
});
test("missing or incorrect encryption keys never save plaintext or overwrite records", async () => {
  const h = setup("");
  try {
    await assert.rejects(
      () => h.request({ enabled: false, credentials: values }),
      (error) => error.status === 409,
    );
    assert.deepEqual(
      (await h.db.prepare("SELECT * FROM config").all()).results,
      [],
    );
  } finally {
    h.db.close();
  }
  const good = setup();
  try {
    await good.request({ enabled: false, credentials: values });
    const before = JSON.stringify(
      (await good.db.prepare("SELECT * FROM config").all()).results,
    );
    const wrong = {
      ...good.env,
      CREDENTIALS: credentialStore(good.db, { key: "c3".repeat(32) }),
    };
    await assert.rejects(
      () => readConfiguration(wrong),
      /could not be decrypted/,
    );
    assert.equal(
      JSON.stringify(
        (await good.db.prepare("SELECT * FROM config").all()).results,
      ),
      before,
    );
  } finally {
    good.db.close();
  }
});
test("environment overrides remain explicitly managed and administrator authorization is required", async () => {
  const h = setup(masterKey, {
    MEDIA_MANAGER_PLAY_SERVICE_ACCOUNT: values.serviceAccount,
  });
  try {
    assert.equal(
      (await credentialStatus(h.env)).credentials.serviceAccount.managed,
      true,
    );
    await assert.rejects(
      () => h.request({ enabled: false, credentials: values }),
      /managed by your hosting/,
    );
    assert.deepEqual(
      (await h.db.prepare("SELECT * FROM config").all()).results,
      [],
    );
    await assert.rejects(
      () => h.request(undefined, { role: "editor" }),
      (error) => error.status === 403,
    );
    await assert.rejects(
      () => h.request(undefined, null),
      (error) => error.status === 401,
    );
  } finally {
    h.db.close();
  }
});
