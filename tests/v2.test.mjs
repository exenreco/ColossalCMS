import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import worker from "../server/worker.mjs";
import { inspectZip, validateManifest } from "../server/plugin-installer.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
const DB = localDatabase(),
  blobs = new Map();
const STORAGE = {
  put: async (k, b) => blobs.set(k, new Uint8Array(b)),
  get: async (k) => {
    const b = blobs.get(k);
    return b ? { body: b, arrayBuffer: async () => b.slice().buffer } : null;
  },
  delete: async (keys) => {
    for (const k of Array.isArray(keys) ? keys : [keys]) blobs.delete(k);
  },
};
const env = {
  DB,
  STORAGE,
  ASSETS: { fetch: async () => new Response("asset") },
};
const owner = {
  "oai-authenticated-user-id": "v2-owner",
  "oai-authenticated-user-email": "owner@v2.test",
};
async function request(path, method = "GET", body, auth = true, extra = {}) {
  const headers = {
    ...(auth ? owner : {}),
    Origin: "https://cms.test",
    ...extra,
  };
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  return worker.fetch(
    new Request("https://cms.test/api" + path, {
      method,
      headers,
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    }),
    env,
  );
}
async function call(...args) {
  const r = await request(...args);
  return { status: r.status, data: await r.json() };
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1sAAAAASUVORK5CYII=",
  "base64",
);
function upload(
  bytes = png,
  name = "pixel.png",
  type = "image/png",
  alt = "A sample pixel",
) {
  const form = new FormData();
  form.set("file", new File([bytes], name, { type }));
  form.set("altText", alt);
  return form;
}
const content = (slug, status = "draft", details = {}) => ({
  kind: "post",
  title: slug,
  slug,
  status,
  body: "Sample text",
  excerpt: "",
  details,
});
const manifest = (version = "1.0.0") => ({
  id: "test.example.notes",
  name: "Notes",
  description: "A test archive",
  author: "Tests",
  license: "MIT",
  version,
  isCore: false,
  requires: { colossal: ">=0.0.1", plugins: [] },
  admin: {
    entryComponent: "NotesComponent",
    menu: { path: "/admin/notes", label: "Notes", order: 90 },
  },
  frontend: { routes: [] },
  runtime: { entry: "index.mjs" },
});
function zipUpload(m = manifest()) {
  const f = new FormData();
  f.set(
    "file",
    new File(
      [
        zipSync({
          "plugin.manifest.json": strToU8(JSON.stringify(m)),
          "index.mjs": strToU8('export const metadata = { name: "Notes" };'),
        }),
      ],
      "notes.zip",
      { type: "application/zip" },
    ),
  );
  return f;
}
before(async () =>
  assert.equal((await call("/admin/setup", "POST", {})).status, 200),
);
after(() => DB.close());
test("media upload validates signatures, image alt text, SVG safety, and size", async () => {
  for (const f of [
    upload(png, "pixel.png", "image/png", ""),
    upload(strToU8("bad"), "pixel.png"),
    upload(
      strToU8(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><script>alert(1)</script></svg>',
      ),
      "bad.svg",
      "image/svg+xml",
    ),
  ])
    assert.equal((await call("/media", "POST", f)).status, 400);
  const response = await worker.fetch(
    new Request("https://cms.test/api/media", {
      method: "POST",
      headers: { ...owner, Origin: "https://cms.test" },
      body: upload(),
    }),
    { ...env, MAX_MEDIA_UPLOAD_BYTES: 10 },
  );
  assert.equal(response.status, 413);
  assert.equal((await call("/media", "POST", upload(), false)).status, 401);
});
test("media metadata persists and replacement keeps stable identity", async () => {
  const created = await call("/media", "POST", upload());
  assert.equal(created.status, 201);
  const m = created.data;
  assert.equal(m.metadata.width, 1);
  assert.equal(m.altText, "A sample pixel");
  const original = await DB.prepare("SELECT storage_key FROM media WHERE id=?")
    .bind(m.id)
    .first();
  const updated = await call("/media/" + m.id, "PATCH", {
    ...m,
    name: "Renamed image",
    caption: "Caption",
    description: "Description",
    tags: ["nature"],
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.data.tags, ["nature"]);
  const replaced = await call("/media/" + m.id + "/replace", "POST", upload());
  assert.equal(replaced.status, 200);
  assert.equal(replaced.data.id, m.id);
  assert.equal(replaced.data.name, "Renamed image");
  assert.equal(blobs.has(original.storage_key), false);
  assert.equal(
    (await request(m.url.replace("/api", ""), "GET", undefined, false)).status,
    401,
  );
  assert.equal((await call("/media/" + m.id, "DELETE", {})).status, 200);
});
test("published references expose media while revisions prevent broken historic content", async () => {
  const m = (await call("/media", "POST", upload())).data;
  const details = {
    featuredImageId: m.id,
    richText: {
      type: "doc",
      content: [{ type: "media", attrs: { mediaId: m.id, type: "image" } }],
    },
  };
  const c = (
    await call(
      "/admin/content",
      "POST",
      content("media-story", "published", details),
    )
  ).data;
  assert.equal(
    (await request(m.url.replace("/api", ""), "GET", undefined, false)).status,
    200,
  );
  const range = await request(
    m.url.replace("/api", ""),
    "GET",
    undefined,
    false,
    { Range: "bytes=0-7" },
  );
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 8);
  assert.equal((await call("/media/" + m.id, "DELETE", {})).status, 409);
  const stored = (await call("/admin/state")).data.content.find(
    (x) => x.id === c.id,
  );
  await call("/admin/content", "POST", { ...stored, details: {} });
  const blocked = await call("/media/" + m.id, "DELETE", {});
  assert.equal(blocked.status, 409);
  assert.ok(blocked.data.references.some((r) => r.kind === "revision"));
  assert.equal(
    (await request(m.url.replace("/api", ""), "GET", undefined, false)).status,
    401,
  );
  await call("/admin/content/" + c.id, "DELETE", {});
  assert.equal((await call("/media/" + m.id, "DELETE", {})).status, 200);
});
test("site icon is public and protected; selected posts page falls back with notice", async () => {
  const m = (await call("/media", "POST", upload())).data;
  const page = (
    await call("/admin/content", "POST", {
      ...content("news", "published"),
      kind: "page",
    })
  ).data;
  const s = (await call("/admin/state")).data.settings;
  assert.equal(
    (
      await call("/admin/settings", "POST", {
        ...s,
        siteIconId: m.id,
        postRouting: "page",
        postsPageId: page.id,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(m.url.replace("/api", ""), "GET", undefined, false)).status,
    200,
  );
  assert.equal((await call("/media/" + m.id, "DELETE", {})).status, 409);
  await call("/admin/content/" + page.id, "DELETE", {});
  const state = (await call("/admin/state")).data;
  assert.equal(state.settings.postRouting, "home");
  assert.ok(
    state.notices.some((n) => n.message.includes("deleted or unpublished")),
  );
  await call("/admin/settings", "POST", { ...state.settings, siteIconId: "" });
  await call("/media/" + m.id, "DELETE", {});
});
test("pending review stays private, rich text rejects unsafe links, missing media rejected", async () => {
  const c = await call(
    "/admin/content",
    "POST",
    content("review-me", "pending"),
  );
  assert.equal(c.status, 200);
  assert.ok(
    !(await call("/public")).data.content.some((x) => x.id === c.data.id),
  );
  const unsafe = {
    richText: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "bad",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    },
  };
  assert.equal(
    (await call("/admin/content", "POST", content("unsafe", "draft", unsafe)))
      .status,
    400,
  );
  assert.equal(
    (
      await call(
        "/admin/content",
        "POST",
        content("missing-media", "draft", { featuredImageId: "missing" }),
      )
    ).status,
    400,
  );
});
test("published autosave preserves live text and creates a recoverable revision; stale saves conflict", async () => {
  const c = (
    await call("/admin/content", "POST", content("autosave-story", "published"))
  ).data;
  const stored = (await call("/admin/state")).data.content.find(
    (x) => x.id === c.id,
  );
  const saved = await call("/admin/content", "POST", {
    ...stored,
    body: "Unpublished working copy",
    autosave: true,
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.autosaved, true);
  assert.equal(
    (await call("/public")).data.content.find((x) => x.id === c.id).body,
    "Sample text",
  );
  assert.ok(
    (await call("/admin/content/" + c.id + "/revisions")).data.some(
      (r) => r.snapshot.body === "Unpublished working copy",
    ),
  );
  assert.equal(
    (
      await call("/admin/content", "POST", {
        ...stored,
        expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
      })
    ).status,
    409,
  );
});
test("ZIP parser rejects traversal, missing manifest, corruption, and incompatible versions", () => {
  assert.throws(
    () => inspectZip(zipSync({ "../outside.mjs": strToU8("bad") })),
    /Unsafe/,
  );
  assert.throws(
    () => inspectZip(zipSync({ "other.json": strToU8("{}") })),
    /root/,
  );
  assert.throws(
    () =>
      validateManifest({
        ...manifest(),
        requires: { colossal: ">=3.0.0", plugins: [] },
      }),
    /compatible/,
  );
  assert.throws(
    () => validateManifest({ ...manifest(), isCore: true }),
    /core/,
  );
  const zip = zipSync(
    { "plugin.manifest.json": strToU8(JSON.stringify(manifest())) },
    { level: 0 },
  );
  const view = new DataView(zip.buffer);
  let i = 0;
  for (; i < zip.length - 4; i++)
    if (view.getUint32(i, true) === 0x02014b50) break;
  zip[i + 16] ^= 1;
  assert.throws(() => inspectZip(zip), /checksum/);
});
test("ZIP installation stays inactive, rejects missing dependencies, and cleans up on discard", async () => {
  const baseline = blobs.size;
  assert.equal(
    (
      await call(
        "/plugins/install",
        "POST",
        zipUpload({
          ...manifest(),
          requires: { colossal: ">=0.0.1", plugins: ["missing.dep"] },
        }),
      )
    ).status,
    400,
  );
  const r = await call("/plugins/install", "POST", zipUpload());
  assert.equal(r.status, 201);
  assert.equal(r.data.plugin.active, false);
  assert.equal(r.data.plugin.pending, true);
  const id = r.data.plugin.id;
  assert.equal(
    (
      await call("/plugins/" + id + "/activate", "POST", {
        revision: r.data.plugin.revision,
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/plugins/" + id + "/discard", "POST", {})).status,
    200,
  );
  assert.equal(blobs.size, baseline);
  assert.ok(
    !(await call("/admin/state")).data.plugins.some((p) => p.id === id),
  );
});
test("ZIP failed storage writes roll back all staged files without registering plugin", async () => {
  const baseline = blobs.size;
  let writes = 0;
  const failing = {
    ...env,
    STORAGE: {
      ...STORAGE,
      put: async (k, b) => {
        if (++writes === 2) throw new Error("Storage unavailable");
        return STORAGE.put(k, b);
      },
    },
  };
  const r = await worker.fetch(
    new Request("https://cms.test/api/plugins/install", {
      method: "POST",
      headers: { ...owner, Origin: "https://cms.test" },
      body: zipUpload(),
    }),
    failing,
  );
  assert.equal(r.status, 500);
  assert.equal(blobs.size, baseline);
  assert.ok(
    !(await call("/admin/state")).data.plugins.some(
      (p) => p.id === manifest().id,
    ),
  );
});
test("V2 core media and ordered manifest metadata are present", async () => {
  const plugins = (await call("/admin/state")).data.plugins;
  assert.ok(
    plugins.some((p) => p.id === "com.colossal.media" && p.active && p.isCore),
  );
  assert.deepEqual(
    plugins.map((p) => p.admin.menu.order),
    plugins.map((p) => p.admin.menu.order).sort((a, b) => a - b),
  );
  assert.ok(plugins.every((p) => p.license && p.requires.colossal));
});
