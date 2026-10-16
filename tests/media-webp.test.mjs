import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { imageOptimizer } from "../plugins/media/image-optimizer.mjs";
import { variantKey, acceptsWebp } from "../plugins/media/variants.mjs";
import { handleMedia, serveMedia } from "../server/media.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { createVercelHandler } from "../scripts/vercel-handler.mjs";
import { publicMediaReferences } from "../server/v2-utils.mjs";
const png = () =>
  sharp({
    create: {
      width: 24,
      height: 16,
      channels: 4,
      background: { r: 80, g: 120, b: 200, alpha: 0.35 },
    },
  })
    .png()
    .toBuffer();

test("public logos and verified admin thumbnails never scan revisions or theme history", async () => {
  const f = await fixture();
  try {
    const item = await f.upload(await png());
    await f.DB.prepare("INSERT INTO config (id,value) VALUES ('site',?)")
      .bind(JSON.stringify({ siteLogoId: item.id }))
      .run();
    const prepare = f.DB.prepare;
    const operations = [];
    f.env.DB = {
      prepare(sql) {
        operations.push(sql);
        if (/\b(?:revisions|theme_history|content|themes)\b/i.test(sql))
          throw new Error("Expensive history/reference scan must not run");
        return prepare(sql);
      },
    };
    const publicLogo = await f.get(item.id, {
      headers: { Accept: "image/webp" },
    });
    assert.equal(publicLogo.status, 200);
    assert.equal(
      (await sharp(new Uint8Array(await publicLogo.arrayBuffer())).metadata())
        .format,
      "webp",
    );
    assert.match(publicLogo.headers.get("Server-Timing"), /media-access;dur=/);
    operations.length = 0;
    let checked = false;
    const admin = await serveMedia(
      new Request(`https://cms.test/api/media/${item.id}/file`, {
        headers: {
          "oai-authenticated-user-id": "member",
          Accept: "image/webp",
        },
      }),
      f.env,
      item.id,
      async () => {
        checked = true;
        return { role: "admin" };
      },
    );
    assert.equal(admin.status, 200);
    assert.equal(checked, true);
    assert.deepEqual(operations, ["SELECT * FROM media WHERE id=?"]);
    assert.equal(admin.headers.get("Vercel-CDN-Cache-Control"), null);
    await assert.rejects(
      serveMedia(
        new Request(`https://cms.test/api/media/${item.id}/file`, {
          headers: { "oai-authenticated-user-id": "forged" },
        }),
        f.env,
        item.id,
        async () => {
          throw Object.assign(new Error("Unauthorized"), { status: 401 });
        },
      ),
      /Unauthorized/,
    );
  } finally {
    f.DB.close();
  }
});

test("public media access uses current published records and excludes drafts, future posts and historical references", async () => {
  const db = localDatabase();
  try {
    const add = (id, status, publishAt, imageId) =>
      db
        .prepare(
          "INSERT INTO content (id,kind,title,slug,excerpt,body,status,publish_at,updated_at,author,details) VALUES (?,'post',?,?,'','',?,?,'now','author',?)",
        )
        .bind(
          id,
          id,
          id,
          status,
          publishAt,
          JSON.stringify({ featuredImageId: imageId }),
        )
        .run();
    await add("published", "published", "2000-01-01", "public-img");
    await add("draft", "draft", "2000-01-01", "draft-img");
    await add("future", "scheduled", "2999-01-01", "future-img");
    const prepare = db.prepare;
    const inspected = {
      prepare(sql) {
        assert.doesNotMatch(sql, /\b(?:revisions|theme_history|draft)\b/i);
        return prepare(sql);
      },
    };
    assert.equal(
      (await publicMediaReferences(inspected, "public-img")).length,
      1,
    );
    assert.equal(
      (await publicMediaReferences(inspected, "draft-img")).length,
      0,
    );
    assert.equal(
      (await publicMediaReferences(inspected, "future-img")).length,
      0,
    );
    const document = JSON.stringify({
      templates: { home: { settings: { mediaId: "theme-img" } } },
      parts: {},
    });
    await db
      .prepare(
        "INSERT INTO themes (id,manifest,published,active,updated_at) VALUES ('theme','{}',?,0,'now')",
      )
      .bind(document)
      .run();
    assert.equal(
      (await publicMediaReferences(inspected, "theme-img")).length,
      0,
    );
    await db.prepare("UPDATE themes SET active=1 WHERE id='theme'").run();
    assert.equal(
      (await publicMediaReferences(inspected, "theme-img")).length,
      1,
    );
  } finally {
    db.close();
  }
});

test("responsive images resize once, use bounded widths, cache only versioned public images and clean up", async () => {
  let conversions = 0;
  const f = await fixture({
    toWebp: (...args) => {
      conversions++;
      return imageOptimizer.toWebp(...args);
    },
  });
  try {
    const bytes = await sharp({
      create: {
        width: 1100,
        height: 700,
        channels: 4,
        background: { r: 20, g: 80, b: 130, alpha: 0.4 },
      },
    })
      .png()
      .toBuffer();
    const item = await f.upload(bytes);
    await f.DB.prepare("INSERT INTO config (id,value) VALUES ('site',?)")
      .bind(JSON.stringify({ siteLogoId: item.id }))
      .run();
    const query = `?format=webp&width=320&v=${encodeURIComponent(item.updatedAt)}`;
    const resized = await f.get(item.id, {}, query);
    const metadata = await sharp(
      new Uint8Array(await resized.arrayBuffer()),
    ).metadata();
    assert.equal(metadata.width, 320);
    assert.equal(metadata.height, 204);
    assert.equal(metadata.hasAlpha, true);
    assert.equal(resized.headers.get("Vary"), null);
    assert.equal(
      resized.headers.get("Vercel-CDN-Cache-Control"),
      "public, max-age=60",
    );
    assert.match(item.srcset, /width=960/);
    assert.doesNotMatch(item.srcset, /width=1280/);
    const before = conversions;
    await f.get(item.id, {}, query);
    assert.equal(conversions, before);
    const revalidated = await f.get(
      item.id,
      { headers: { "If-None-Match": resized.headers.get("ETag") } },
      query,
    );
    assert.equal(revalidated.status, 304);
    for (const options of [
      { headers: { Cookie: "session=private" } },
      { headers: { Authorization: "Bearer private" } },
      { headers: { Range: "bytes=0-9" } },
    ]) {
      const privateResponse = await f.get(item.id, options, query);
      assert.equal(
        privateResponse.headers.get("Vercel-CDN-Cache-Control"),
        null,
      );
      assert.equal(
        privateResponse.headers.get("Cache-Control"),
        "private, no-store",
      );
    }
    for (const suffix of ["&themePreview=private", "&download=1"]) {
      const privateResponse = await f.get(item.id, {}, query + suffix);
      assert.equal(
        privateResponse.headers.get("Vercel-CDN-Cache-Control"),
        null,
      );
    }
    assert.equal(
      (await f.get(item.id, {}, "?format=webp&width=320&v=old")).headers.get(
        "Vercel-CDN-Cache-Control",
      ),
      null,
    );
    await assert.rejects(f.get(item.id, {}, "?format=webp&width=321"));
    const handler = createVercelHandler(
      { CMS_PUBLIC_URL: "https://cms.test" },
      async () => ({ ...f.env, AUTH: { identify: async () => null } }),
    );
    let delivered;
    await handler(
      { url: `/api/media/${item.id}/file${query}`, method: "GET", headers: {} },
      {
        writeHead(status, headers) {
          delivered = new Headers(headers);
          assert.equal(status, 200);
        },
        end() {},
      },
    );
    assert.equal(
      delivered.get("Vercel-CDN-Cache-Control"),
      "public, max-age=60",
    );
    assert.equal(delivered.get("X-Colossal-Public-Media"), null);
    assert.match(delivered.get("Server-Timing"), /runtime;dur=/);
    await f.upload(bytes, "replacement.png", "image/png", item.id);
    assert.equal(
      [...f.blobs.keys()].filter((key) => key.includes(".w320.webp")).length,
      0,
    );
  } finally {
    f.DB.close();
  }
});
async function fixture(optimizer = imageOptimizer) {
  const DB = localDatabase(),
    blobs = new Map();
  const STORAGE = {
    put: async (key, bytes) => {
      blobs.set(key, new Uint8Array(bytes));
    },
    get: async (key) => {
      const data = blobs.get(key);
      return data ? { arrayBuffer: async () => data.slice().buffer } : null;
    },
    delete: async (key) => {
      blobs.delete(key);
    },
  };
  const env = { DB, STORAGE, IMAGE_OPTIMIZER: optimizer };
  const upload = async (bytes, name = "sample.png", type = "image/png", id) => {
    const form = new FormData();
    form.set("file", new File([bytes], name, { type }));
    form.set("altText", "Sample image");
    const path = id ? `/api/media/${id}/replace` : "/api/media";
    const response = await handleMedia(
      new Request("https://cms.test" + path, { method: "POST", body: form }),
      env,
      { email: "test@example.test" },
      path,
    );
    return response.json();
  };
  const get = async (id, options = {}, url = "") =>
    serveMedia(
      new Request(`https://cms.test/api/media/${id}/file${url}`, options),
      env,
      id,
      async () => ({ role: "admin" }),
    );
  return { DB, STORAGE, blobs, env, upload, get };
}
test("WebP codec preserves transparency, dimensions, JPEG orientation and animated GIF frames", async () => {
  const converted = await imageOptimizer.toWebp(await png(), "image/png");
  assert.ok(converted);
  const metadata = await sharp(converted.bytes).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 24);
  assert.equal(metadata.height, 16);
  assert.equal(metadata.hasAlpha, true);
  const original = await sharp({
    create: { width: 10, height: 20, channels: 3, background: "white" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const rotated = await imageOptimizer.toWebp(original, "image/jpeg");
  assert.equal(rotated.width, 20);
  assert.equal(rotated.height, 10);
  assert.equal((await sharp(rotated.bytes).metadata()).orientation, undefined);
  const raw = Buffer.alloc(12 * 24 * 4);
  for (let p = 0; p < 12 * 24; p++) {
    raw[p * 4 + (p < 12 * 12 ? 0 : 1)] = 255;
    raw[p * 4 + 3] = 255;
  }
  const gif = await sharp(raw, {
    raw: { width: 12, height: 24, pageHeight: 12, channels: 4 },
  })
    .gif({ delay: [100, 200], loop: 2 })
    .toBuffer();
  const animated = await imageOptimizer.toWebp(gif, "image/gif"),
    frames = await sharp(animated.bytes, { animated: true }).metadata();
  assert.equal(frames.pages, 2);
  assert.deepEqual(frames.delay, [100, 200]);
  assert.equal(frames.loop, 2);
  assert.equal(animated.height, 12);
  assert.equal(
    await imageOptimizer.toWebp(
      new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      "image/svg+xml",
    ),
    null,
  );
});
test("uploads retain the original and negotiate WebP with truthful MIME, length, HEAD and range responses", async () => {
  const f = await fixture();
  try {
    const original = await png(),
      item = await f.upload(original);
    assert.equal(item.mime, "image/png");
    assert.equal(item.metadata.webpStatus, "ready");
    assert.equal(f.blobs.size, 2);
    const webp = await f.get(item.id, {
      headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
    });
    assert.equal(webp.headers.get("Content-Type"), "image/webp");
    assert.equal(webp.headers.get("Vary"), "Accept");
    const bytes = new Uint8Array(await webp.arrayBuffer());
    assert.equal(webp.headers.get("Content-Length"), String(bytes.length));
    assert.equal((await sharp(bytes).metadata()).format, "webp");
    const fallback = await f.get(item.id, { headers: { Accept: "image/png" } });
    assert.deepEqual(
      new Uint8Array(await fallback.arrayBuffer()),
      new Uint8Array(original),
    );
    const download = await f.get(
      item.id,
      { headers: { Accept: "image/webp" } },
      "?format=original&download=1",
    );
    assert.equal(download.headers.get("Content-Type"), "image/png");
    assert.match(download.headers.get("Content-Disposition"), /attachment/);
    assert.deepEqual(
      new Uint8Array(await download.arrayBuffer()),
      new Uint8Array(original),
    );
    const range = await f.get(item.id, {
      headers: { Accept: "image/webp", Range: "bytes=0-11" },
    });
    assert.equal(range.status, 206);
    assert.deepEqual(
      new Uint8Array(await range.arrayBuffer()),
      bytes.slice(0, 12),
    );
    assert.equal(
      range.headers.get("Content-Range"),
      `bytes 0-11/${bytes.length}`,
    );
    const head = await f.get(item.id, {
      method: "HEAD",
      headers: { Accept: "image/webp", Range: "bytes=0-11" },
    });
    assert.equal(head.status, 206);
    assert.equal(await head.text(), "");
    assert.equal(head.headers.get("Content-Length"), "12");
    assert.equal(
      acceptsWebp(
        new Request("https://cms.test", {
          headers: { Accept: "image/webp;q=0,image/png" },
        }),
      ),
      false,
    );
  } finally {
    await f.DB.close();
  }
});
test("existing uploads are optimized once on first authorized WebP use and original access does not convert", async () => {
  const f = await fixture(undefined);
  let conversions = 0;
  try {
    delete f.env.IMAGE_OPTIMIZER;
    const item = await f.upload(await png());
    assert.equal(f.blobs.size, 1);
    f.env.IMAGE_OPTIMIZER = {
      toWebp: async (...args) => {
        conversions++;
        return imageOptimizer.toWebp(...args);
      },
    };
    await f.get(item.id, {}, "?format=original");
    assert.equal(conversions, 0);
    await assert.rejects(
      serveMedia(
        new Request("https://cms.test/api/media/" + item.id + "/file", {
          headers: { Accept: "image/webp" },
        }),
        f.env,
        item.id,
        async () => {
          throw Object.assign(Error("Sign in"), { status: 401 });
        },
      ),
      { status: 401 },
    );
    assert.equal(conversions, 0);
    await Promise.all([
      f.get(item.id, { headers: { Accept: "image/webp" } }),
      f.get(item.id, { headers: { Accept: "image/webp" } }),
    ]);
    assert.equal(conversions, 1);
    assert.equal(f.blobs.size, 2);
    const record = await f.DB.prepare("SELECT * FROM media WHERE id=?")
      .bind(item.id)
      .first();
    assert.ok(variantKey(record));
    await f.get(item.id, { headers: { Accept: "image/webp" } });
    assert.equal(conversions, 1);
  } finally {
    await f.DB.close();
  }
});
test("replacement and deletion clean up derivative blobs, and failed conversion never loses the original", async () => {
  const f = await fixture();
  try {
    const first = await f.upload(await png()),
      oldKeys = [...f.blobs.keys()];
    await f.upload(await png(), "replacement.png", "image/png", first.id);
    assert.equal(f.blobs.size, 2);
    assert.ok(oldKeys.every((key) => !f.blobs.has(key)));
    await handleMedia(
      new Request("https://cms.test/api/media/" + first.id, {
        method: "DELETE",
      }),
      f.env,
      { email: "test@example.test" },
      "/api/media/" + first.id,
    );
    assert.equal(f.blobs.size, 0);
    f.env.IMAGE_OPTIMIZER = {
      toWebp: async () => {
        throw Error("Codec unavailable");
      },
    };
    const bytes = await png(),
      failed = await f.upload(bytes);
    assert.equal(failed.metadata.webpStatus, "unavailable");
    assert.equal(f.blobs.size, 1);
    const response = await f.get(failed.id, {
      headers: { Accept: "image/webp" },
    });
    assert.equal(response.headers.get("Content-Type"), "image/png");
    assert.deepEqual(
      new Uint8Array(await response.arrayBuffer()),
      new Uint8Array(bytes),
    );
  } finally {
    await f.DB.close();
  }
});
test("missing WebP data falls back to the original and variant metadata cannot point at an unrelated key", async () => {
  const f = await fixture();
  try {
    const item = await f.upload(await png()),
      record = await f.DB.prepare("SELECT * FROM media WHERE id=?")
        .bind(item.id)
        .first();
    const key = variantKey(record);
    assert.ok(key);
    await f.STORAGE.delete(key);
    const response = await f.get(item.id, {
      headers: { Accept: "image/webp" },
    });
    assert.equal(response.headers.get("Content-Type"), "image/png");
    assert.equal(
      variantKey({
        ...record,
        metadata: JSON.stringify({
          webp: {
            sourceKey: record.storage_key,
            storageKey: "media/another/private.webp",
          },
        }),
      }),
      "",
    );
  } finally {
    await f.DB.close();
  }
});
