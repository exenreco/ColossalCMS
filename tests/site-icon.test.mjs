import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { localDatabase } from "../scripts/local-database.mjs";
import worker from "../server/worker.mjs";
import { imageOptimizer } from "../plugins/media/image-optimizer.mjs";
import { cacheCandidate } from "../plugins/caching/server.mjs";

test("configured icons have an anonymous crawlable PNG alias, conditional requests and correct replacement behavior", async () => {
  const DB = localDatabase();
  let conversions = 0;
  const bytes = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="48"><rect width="96" height="48" fill="#56df95"/></svg>',
  );
  const env = {
    DB,
    STORAGE: {
      get: async (key) => (key === "icon.svg" ? new Response(bytes) : null),
    },
    IMAGE_OPTIMIZER: {
      toIcon: async (input) => {
        conversions++;
        return imageOptimizer.toIcon(input);
      },
    },
    ASSETS: {
      fetch: async () =>
        new Response("CORE_ICON", {
          headers: { "Content-Type": "image/svg+xml" },
        }),
    },
  };
  const call = (path, options = {}) =>
    worker.fetch(new Request("https://cms.test" + path, options), env);
  try {
    await DB.prepare("INSERT INTO config(id,value) VALUES ('site',?)")
      .bind(
        JSON.stringify({
          siteIconId: "custom-icon",
          siteLogoId: "private-logo",
        }),
      )
      .run();
    await DB.prepare(
      "INSERT INTO media (id,type,name,mime,storage_key,alt_text,caption,description,tags,metadata,uploaded_by,uploaded_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        "custom-icon",
        "image",
        "Icon",
        "image/svg+xml",
        "icon.svg",
        "",
        "",
        "",
        "[]",
        "{}",
        "owner",
        "2026-10-23",
        "2026-10-23",
      )
      .run();
    const icon = await call("/site-icon?id=private-logo");
    assert.equal(icon.status, 200);
    assert.equal(icon.headers.get("Content-Type"), "image/png");
    const png = new Uint8Array(await icon.arrayBuffer());
    const metadata = await sharp(png).metadata();
    assert.equal(metadata.width, 512);
    assert.equal(metadata.height, 512);
    assert.equal(metadata.hasAlpha, true);
    const { data, info } = await sharp(png)
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(data[3], 0, "non-square source is padded transparently");
    assert.equal(
      data[(256 * info.width + 256) * info.channels + 3],
      255,
      "authored icon stays visible",
    );
    const tag = icon.headers.get("ETag");
    assert.equal(
      (await call("/site-icon", { headers: { "If-None-Match": tag } })).status,
      304,
    );
    const head = await call("/site-icon", { method: "HEAD" });
    assert.equal(head.headers.get("Content-Type"), "image/png");
    assert.equal(await head.text(), "");
    assert.equal(conversions, 1, "warm requests reuse the rendition");
    await DB.prepare(
      "UPDATE media SET updated_at='2026-10-24' WHERE id='custom-icon'",
    ).run();
    assert.equal((await call("/site-icon")).status, 200);
    assert.equal(conversions, 2, "replaced media invalidates the rendition");
    assert.equal(
      cacheCandidate(new Request("https://cms.test/site-icon")),
      null,
    );
    await DB.prepare("UPDATE config SET value=? WHERE id='site'")
      .bind(JSON.stringify({ siteIconId: "" }))
      .run();
    assert.equal(await (await call("/site-icon")).text(), "CORE_ICON");
    await DB.prepare("UPDATE config SET value=? WHERE id='site'")
      .bind(JSON.stringify({ siteIconId: "private-logo" }))
      .run();
    assert.equal(
      (await call("/site-icon")).status,
      404,
      "unknown IDs cannot select another file",
    );
  } finally {
    DB.close();
  }
});
