import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { inspectMedia } from "../server/media.mjs";
import { inspectIco } from "../shared/ico.mjs";
import { imageOptimizer } from "../plugins/media/image-optimizer.mjs";
import worker from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";

function ico(frames) {
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, bytes }, i) => {
    const entry = 6 + i * 16;
    header[entry] = header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(bytes.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += bytes.length;
  });
  return Buffer.concat([header, ...frames.map((frame) => frame.bytes)]);
}
async function pngIco() {
  return ico(
    await Promise.all(
      [16, 32, 256].map(async (size) => ({
        size,
        bytes: await sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            background: "#56df95",
          },
        })
          .png()
          .toBuffer(),
      })),
    ),
  );
}

test("ICO validates multi-size PNG and classic bitmap frames and rejects malformed directories", async () => {
  const bytes = await pngIco();
  for (const mime of [
    "image/vnd.microsoft.icon",
    "image/x-icon",
    "image/ico",
    "application/octet-stream",
    "",
  ]) {
    const media = inspectMedia(bytes, "FAVICON.ICO", mime);
    assert.equal(media.type, "image");
    assert.equal(media.mime, "image/vnd.microsoft.icon");
    assert.equal(media.metadata.width, 256);
    assert.equal(media.metadata.height, 256);
    assert.deepEqual(
      media.metadata.iconSizes.map((size) => size.width),
      [256, 32, 16],
    );
  }
  const dib = Buffer.alloc(40 + 16 * 16 * 4 + 16 * 4);
  dib.writeUInt32LE(40, 0);
  dib.writeInt32LE(16, 4);
  dib.writeInt32LE(32, 8);
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  assert.equal(inspectIco(ico([{ size: 16, bytes: dib }]))[0].format, "dib");
  const invalid = [];
  invalid.push(Buffer.from("<html>not an icon</html>"), bytes.subarray(0, 20));
  const cursor = Buffer.from(bytes);
  cursor.writeUInt16LE(2, 2);
  invalid.push(cursor);
  const offset = Buffer.from(bytes);
  offset.writeUInt32LE(0, 18);
  invalid.push(offset);
  const count = Buffer.from(bytes);
  count.writeUInt16LE(300, 4);
  invalid.push(count);
  const dimensions = Buffer.from(bytes);
  dimensions[6] = 48;
  invalid.push(dimensions);
  for (const bad of invalid)
    assert.throws(() => inspectMedia(bad, "bad.ico", "image/x-icon"));
  assert.throws(() => inspectMedia(bytes, "icon.ico", "image/png"));
  const rendered = await imageOptimizer.toIcon(bytes);
  const info = await sharp(rendered).metadata();
  assert.equal(info.format, "png");
  assert.equal(info.width, 512);
  assert.equal(info.height, 512);
});

test("ICO uploads, previews, replacement and Site Icon selection preserve original bytes", async () => {
  const DB = localDatabase(),
    blobs = new Map();
  const env = {
    DB,
    IMAGE_OPTIMIZER: imageOptimizer,
    STORAGE: {
      put: async (key, bytes) => blobs.set(key, new Uint8Array(bytes)),
      get: async (key) =>
        blobs.has(key) ? new Response(blobs.get(key)) : null,
      delete: async (keys) => {
        for (const key of Array.isArray(keys) ? keys : [keys])
          blobs.delete(key);
      },
    },
    ASSETS: { fetch: async () => new Response("asset") },
  };
  const headers = {
    "oai-authenticated-user-id": "icon-owner",
    "oai-authenticated-user-email": "icon@example.test",
    Origin: "https://cms.test",
  };
  const call = (path, method = "GET", body, authenticated = true) =>
    worker.fetch(
      new Request("https://cms.test" + path, {
        method,
        headers: {
          ...(authenticated ? headers : {}),
          ...(typeof body === "string"
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body,
      }),
      env,
    );
  const form = (bytes) => {
    const data = new FormData();
    data.append(
      "file",
      new File([bytes], "portfolio.ico", { type: "image/x-icon" }),
    );
    data.append("altText", "Portfolio icon");
    return data;
  };
  try {
    assert.equal(
      (await call("/api/admin/setup", "POST", JSON.stringify({}))).status,
      200,
    );
    const original = await pngIco();
    const uploaded = await call("/api/media", "POST", form(original));
    assert.equal(uploaded.status, 201, await uploaded.clone().text());
    const media = await uploaded.json();
    assert.equal(media.type, "image");
    assert.equal(media.mime, "image/vnd.microsoft.icon");
    const preview = await call(`/api/media/${media.id}/file`);
    assert.equal(
      preview.headers.get("Content-Type"),
      "image/vnd.microsoft.icon",
    );
    assert.deepEqual(
      new Uint8Array(await preview.arrayBuffer()),
      new Uint8Array(original),
    );
    assert.equal(
      (await call(`/api/media/${media.id}/replace`, "POST", form(original)))
        .status,
      200,
    );
    assert.equal(
      (
        await call(
          "/api/admin/settings",
          "POST",
          JSON.stringify({ siteIconId: media.id }),
        )
      ).status,
      200,
    );
    const icon = await call("/site-icon", "GET", undefined, false);
    assert.equal(icon.status, 200);
    assert.equal(icon.headers.get("Content-Type"), "image/png");
    assert.equal((await sharp(await icon.arrayBuffer()).metadata()).width, 512);
  } finally {
    DB.close();
  }
});
