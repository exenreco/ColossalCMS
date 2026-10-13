import test from "node:test";
import assert from "node:assert/strict";
import { localDatabase } from "../scripts/local-database.mjs";
import { migrateSiteAppearance } from "../server/site-appearance.mjs";
import { serveMedia } from "../server/media.mjs";
import worker from "../server/worker.mjs";

test("legacy logo becomes a Site Icon library image once, preserving explicit icons and other settings", async () => {
  const db = localDatabase();
  try {
    await db
      .prepare("INSERT INTO config (id,value) VALUES ('site',?)")
      .bind(
        JSON.stringify({
          title: "Studio",
          logo: "https://example.test/logo.svg",
          tagline: "Hello",
        }),
      )
      .run();
    await migrateSiteAppearance(db);
    const first = await db
      .prepare("SELECT value FROM config WHERE id='site'")
      .first();
    const settings = JSON.parse(first.value);
    assert.equal(settings.adminColorMode, "system");
    assert.equal(settings.logo, undefined);
    assert.equal(settings.tagline, "Hello");
    assert.ok(settings.siteIconId);
    assert.equal(settings.siteLogoId, settings.siteIconId);
    const media = await db
      .prepare("SELECT * FROM media WHERE id=?")
      .bind(settings.siteIconId)
      .first();
    assert.equal(
      JSON.parse(media.metadata).externalUrl,
      "https://example.test/logo.svg",
    );
    const response = await serveMedia(
      new Request("https://cms.test/api/media/" + media.id + "/file"),
      { DB: db },
      media.id,
      () => {
        throw new Error("Published icon should be public");
      },
    );
    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get("Location"),
      "https://example.test/logo.svg",
    );
    await migrateSiteAppearance(db);
    assert.deepEqual(
      await db.prepare("SELECT value FROM config WHERE id='site'").first(),
      first,
    );
    await db
      .prepare("UPDATE config SET value=? WHERE id='site'")
      .bind(
        JSON.stringify({
          title: "Studio",
          logo: "https://example.test/other.png",
          siteIconId: media.id,
          adminColorMode: "dark",
        }),
      )
      .run();
    await migrateSiteAppearance(db);
    const preserved = JSON.parse(
      (await db.prepare("SELECT value FROM config WHERE id='site'").first())
        .value,
    );
    assert.equal(preserved.siteIconId, media.id);
    assert.equal(preserved.siteLogoId, media.id);
    assert.equal(preserved.adminColorMode, "dark");
    assert.equal(
      (await db.prepare("SELECT COUNT(*) AS count FROM media").first()).count,
      1,
    );
  } finally {
    db.close();
  }
});

test("admin appearance persists Light, Dark and System and rejects unsupported modes", async () => {
  const DB = localDatabase();
  const headers = {
    Origin: "https://cms.test",
    "Content-Type": "application/json",
    "oai-authenticated-user-id": "owner",
    "oai-authenticated-user-email": "owner@example.test",
  };
  const call = (path, method = "GET", body) =>
    worker.fetch(
      new Request("https://cms.test" + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      }),
      { DB },
    );
  try {
    await call("/api/admin/setup", "POST", {});
    for (const adminColorMode of ["light", "dark", "system"]) {
      assert.equal(
        (await call("/api/admin/settings", "POST", { adminColorMode })).status,
        200,
      );
      const state = await (await call("/api/admin/state")).json();
      assert.equal(state.settings.adminColorMode, adminColorMode);
      assert.equal(state.settings.logo, undefined);
    }
    assert.equal(
      (await call("/api/admin/settings", "POST", { adminColorMode: "blue" }))
        .status,
      400,
    );
  } finally {
    DB.close();
  }
});

test("site logo and browser icon remain independent, public and protected from deletion", async () => {
  const DB = localDatabase();
  const headers = {
    Origin: "https://cms.test",
    "Content-Type": "application/json",
    "oai-authenticated-user-id": "owner",
    "oai-authenticated-user-email": "owner@example.test",
  };
  const call = (path, method = "GET", body, authenticated = true) =>
    worker.fetch(
      new Request("https://cms.test/api" + path, {
        method,
        headers: authenticated ? headers : {},
        body: body ? JSON.stringify(body) : undefined,
      }),
      {
        DB,
        STORAGE: {
          get: async () => null,
          put: async () => {},
          delete: async () => {},
        },
      },
    );
  try {
    await call("/admin/setup", "POST", {});
    for (const id of ["favicon", "brand-logo"]) {
      await DB.prepare(
        "INSERT INTO media (id,type,name,mime,storage_key,alt_text,caption,description,tags,metadata,uploaded_by,uploaded_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
        .bind(
          id,
          "image",
          id,
          "image/png",
          "",
          id,
          "",
          "",
          "[]",
          JSON.stringify({
            externalUrl: "https://example.test/" + id + ".png",
          }),
          "owner",
          "2026-10-13",
          "2026-10-13",
        )
        .run();
    }
    assert.equal(
      (
        await call("/admin/settings", "POST", {
          siteIconId: "favicon",
          siteLogoId: "brand-logo",
        })
      ).status,
      200,
    );
    assert.equal(
      (await call("/media/brand-logo/file", "GET", undefined, false)).status,
      302,
    );
    assert.equal((await call("/media/brand-logo", "DELETE", {})).status, 409);
    assert.equal(
      (await call("/admin/settings", "POST", { siteLogoId: "missing" })).status,
      400,
    );
    assert.equal(
      (await call("/admin/settings", "POST", { siteLogoId: "" })).status,
      200,
    );
    const state = await (await call("/admin/state")).json();
    assert.equal(state.settings.siteIconId, "favicon");
    assert.equal(state.settings.siteLogoId, "");
    await migrateSiteAppearance(DB);
    const settings = JSON.parse(
      (await DB.prepare("SELECT value FROM config WHERE id='site'").first())
        .value,
    );
    assert.equal(
      settings.siteLogoId,
      "",
      "migration must not restore a removed logo",
    );
    assert.equal((await call("/media/brand-logo", "DELETE", {})).status, 200);
    assert.equal(
      (await call("/media/favicon/file", "GET", undefined, false)).status,
      302,
    );
  } finally {
    DB.close();
  }
});
