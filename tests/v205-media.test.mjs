import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import worker from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";

const DB = localDatabase(),
  blobs = new Map();
const env = {
  DB,
  STORAGE: {
    put: async (k, b) => blobs.set(k, new Uint8Array(b)),
    get: async (k) =>
      blobs.has(k)
        ? {
            body: blobs.get(k),
            arrayBuffer: async () => blobs.get(k).slice().buffer,
          }
        : null,
    delete: async (k) => {
      for (const path of Array.isArray(k) ? k : [k]) blobs.delete(path);
    },
  },
  ASSETS: { fetch: async () => new Response("asset") },
};
const headers = {
  "oai-authenticated-user-id": "model-owner",
  "oai-authenticated-user-email": "model@example.test",
  Origin: "https://cms.test",
};
async function send(path, method = "GET", body) {
  return worker.fetch(
    new Request("https://cms.test/api" + path, {
      method,
      headers: {
        ...headers,
        ...(typeof body === "string"
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body,
    }),
    env,
  );
}
before(async () =>
  assert.equal(
    (await send("/admin/setup", "POST", JSON.stringify({}))).status,
    200,
  ),
);
after(() => DB.close());
const form = (filename, text, mime) => {
  const data = new FormData();
  data.append("file", new File([text], filename, { type: mime }));
  data.append("altText", "A simple cube model");
  return data;
};

test("model upload stores metadata and a safe poster; remote references are rejected", async () => {
  const model = JSON.stringify({
    asset: { version: "2.0" },
    buffers: [
      { byteLength: 4, uri: "data:application/octet-stream;base64,AAAAAA==" },
    ],
  });
  const uploaded = await send(
    "/media",
    "POST",
    form("simple.gltf", model, "model/gltf+json"),
  );
  assert.equal(uploaded.status, 201, await uploaded.clone().text());
  const item = await uploaded.json();
  assert.equal(item.type, "model");
  assert.equal(item.metadata.meshCount, 0);
  assert.match(item.thumbnailUrl, /\/poster$/);
  const poster = await send("/media/" + item.id + "/poster");
  assert.equal(poster.status, 200);
  assert.equal(poster.headers.get("content-type"), "image/svg+xml");
  assert.match(await poster.text(), /simple.gltf/);
  const bad = await send(
    "/media",
    "POST",
    form(
      "remote.gltf",
      JSON.stringify({
        asset: { version: "2.0" },
        buffers: [{ byteLength: 4, uri: "https://invalid.test/remote.bin" }],
      }),
      "model/gltf+json",
    ),
  );
  assert.equal(bad.status, 400);
  assert.match(await bad.text(), /remote references/);
});
