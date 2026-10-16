import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { imageOptimizer } from "../plugins/media/image-optimizer.mjs";
import { variantKey, acceptsWebp } from "../plugins/media/variants.mjs";
import { handleMedia, serveMedia } from "../server/media.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
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
