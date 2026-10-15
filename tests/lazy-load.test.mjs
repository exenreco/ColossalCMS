import test from "node:test";
import assert from "node:assert/strict";
import { parseDocument } from "htmlparser2";
import { findAll } from "domutils";
import { decorateImages } from "../plugins/lazy-load/renderer.mjs";
import {
  defaults,
  validateSettings,
  LAZY_LOAD_ID,
} from "../plugins/lazy-load/config.mjs";
import lazyLoad from "../plugins/lazy-load/server.mjs";
import { createPluginRegistry } from "../server/plugin-registry.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { parseSql } from "../scripts/mongo-database.mjs";

test("image decoration preserves hierarchy and responsive sources, prioritizes content, and respects exclusions", () => {
  const original = {
    html: `<header class="theme-part-header"><img src="/logo.svg" alt="Logo"></header><a href="/work"><picture><source srcset="/hero.webp 2x"><img src="/hero.png" width="800" height="600" loading="lazy" alt="Hero"></picture></a><figure><img src="/card.png" srcset="/card-2.png 2x" sizes="50vw" class="card" width="500" height="300"><figcaption>Card</figcaption></figure><img src="/eager.png" loading="eager"><img src="/priority.png" fetchpriority="high"><div class="no-lazy"><img src="/skip.png"></div><img src="data:image/png;base64,AAAA"><img src="/error.png">`,
    css: ".card{width:100%}",
  };
  const rendered = decorateImages(original);
  const tree = parseDocument(rendered.html);
  const images = findAll((n) => n.name === "img", tree.children);
  assert.equal(images[0].attribs["data-cl-lazy-image"], undefined);
  assert.equal(images[1].attribs.loading, "eager");
  assert.equal(images[1].parent.name, "picture");
  assert.equal(images[1].parent.parent.name, "a");
  assert.equal(images[1].attribs.width, "800");
  assert.equal(images[2].parent.name, "figure");
  assert.equal(images[2].attribs.loading, "lazy");
  assert.equal(images[2].attribs.srcset, "/card-2.png 2x");
  assert.equal(images[2].attribs.sizes, "50vw");
  assert.match(images[2].attribs.class, /card cl-lazy-pending/);
  assert.equal(images[3].attribs.loading, "eager");
  assert.notEqual(images[4].attribs.loading, "lazy");
  assert.equal(images[5].attribs["data-cl-lazy-image"], undefined);
  assert.equal(images[6].attribs["data-cl-lazy-image"], undefined);
  assert.match(rendered.css, /prefers-reduced-motion/);
  assert.match(rendered.css, /background-size:28px 28px/);
  assert.match(rendered.html, /<noscript>/);
  assert.deepEqual(decorateImages(rendered), rendered);
  assert.equal(
    decorateImages(original, { ...defaults, enabled: false }),
    original,
  );
  assert.equal(
    decorateImages({ ...original, preview: true }).html,
    original.html,
  );
});

test("Lazy Load settings are admin-only, validated, persisted and gated by plugin activation with Mongo-compatible SQL", async () => {
  const local = localDatabase();
  const db = {
    prepare(sql) {
      const statement = (args = []) => ({
        bind: (...values) => statement(values),
        first: () => {
          parseSql(sql, args);
          return local
            .prepare(sql)
            .bind(...args)
            .first();
        },
        run: () => {
          parseSql(sql, args);
          return local
            .prepare(sql)
            .bind(...args)
            .run();
        },
      });
      return statement();
    },
  };
  const registry = createPluginRegistry([lazyLoad]);
  const original = { html: '<img src="/photo.png">', css: "" };
  const context = { database: () => db };
  const admin = (method = "GET", body, role = "admin") =>
    registry.dispatch("admin", {
      path: "/api/admin/lazy-load",
      request: new Request("https://cms.test/api/admin/lazy-load", {
        method,
        ...(body
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
      }),
      db,
      user: { role },
      log: async () => {},
    });
  try {
    assert.deepEqual(
      await registry.transformRender(original, context),
      original,
    );
    await assert.rejects(admin("GET", undefined, "editor"), { status: 403 });
    assert.deepEqual(await (await admin()).json(), defaults);
    await assert.rejects(
      admin("POST", { ...defaults, spinnerColor: "red;display:none" }),
      /spinner/,
    );
    await assert.rejects(
      admin("POST", { ...defaults, spinnerSize: 999 }),
      /spinner/,
    );
    await local
      .prepare("INSERT INTO plugins(id,active,installed) VALUES (?,1,1)")
      .bind(LAZY_LOAD_ID)
      .run();
    const saved = {
      ...defaults,
      spinnerColor: "#abcdef",
      spinnerSize: 40,
      skipFirstImage: false,
    };
    assert.equal((await admin("POST", saved)).status, 200);
    assert.deepEqual(await (await admin()).json(), saved);
    const rendered = await registry.transformRender(original, context);
    assert.match(rendered.html, /loading="lazy"/);
    assert.match(rendered.css, /background-size:40px 40px/);
    await admin("POST", { ...saved, enabled: false });
    assert.deepEqual(
      await registry.transformRender(original, context),
      original,
    );
    await admin("POST", saved);
    await local
      .prepare("UPDATE plugins SET active=0 WHERE id=?")
      .bind(LAZY_LOAD_ID)
      .run();
    assert.deepEqual(
      await registry.transformRender(original, context),
      original,
    );
  } finally {
    local.close();
  }
});
