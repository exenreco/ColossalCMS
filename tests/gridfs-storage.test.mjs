import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { gridfsStorage, connectGridFS } from "../scripts/gridfs-storage.mjs";
import {
  connectionDefaults,
  validateConnectionConfig,
  connectionManager,
} from "../scripts/connection-manager.mjs";
import { serveMedia } from "../server/media.mjs";

function fixture() {
  const files = new Map(),
    pointers = new Map();
  let id = 0;
  const state = {
    uploadFailure: false,
    pointerFailure: false,
    committedFailure: false,
    readFailure: false,
    closed: false,
  };
  const bucket = {
    openUploadStream() {
      const fileId = ++id,
        parts = [];
      const stream = new Writable({
        write(chunk, encoding, callback) {
          parts.push(Buffer.from(chunk));
          callback(state.uploadFailure ? new Error("Upload failed") : null);
        },
        final(callback) {
          files.set(fileId, Buffer.concat(parts));
          callback();
        },
      });
      stream.id = fileId;
      return stream;
    },
    openDownloadStream(id) {
      assert.ok(files.has(id));
      return Readable.from([files.get(id)]);
    },
    async delete(id) {
      files.delete(id);
    },
  };
  const keys = {
    async findOne({ _id }) {
      if (state.readFailure) throw new Error("Read unavailable");
      return pointers.get(_id) || null;
    },
    async findOneAndUpdate({ _id }, update) {
      if (state.pointerFailure) throw new Error("Pointer failed");
      const previous = pointers.get(_id) || null;
      pointers.set(_id, { _id, fileId: update.$set.fileId });
      if (state.committedFailure) throw new Error("Publication response lost");
      return previous;
    },
    async findOneAndDelete({ _id }) {
      const previous = pointers.get(_id) || null;
      pointers.delete(_id);
      return previous;
    },
  };
  return {
    files,
    state,
    storage: gridfsStorage(bucket, keys, async () => {
      state.closed = true;
    }),
  };
}

test("GridFS round-trips binary media, replaces safely, handles concurrent writes and deletes", async () => {
  const { storage, files, state } = fixture();
  const bytes = Uint8Array.from([0, 255, 10, 48, 128]);
  await storage.put("media/photo.png", bytes.buffer);
  assert.deepEqual(
    new Uint8Array(await (await storage.get("media/photo.png")).arrayBuffer()),
    bytes,
  );
  assert.equal((await storage.get("media/photo.png")).size, 5);
  state.uploadFailure = true;
  await assert.rejects(
    storage.put("media/photo.png", Buffer.from("broken")),
    /Upload failed/,
  );
  assert.equal(files.size, 1);
  assert.deepEqual(
    (await storage.get("media/photo.png")).body,
    Buffer.from(bytes),
  );
  state.uploadFailure = false;
  state.pointerFailure = true;
  await assert.rejects(
    storage.put("media/photo.png", Buffer.from("unpublished")),
    /Pointer failed/,
  );
  assert.equal(files.size, 1);
  state.pointerFailure = false;
  await Promise.all([
    storage.put("media/photo.png", Buffer.from("a")),
    storage.put("media/photo.png", Buffer.from("b")),
  ]);
  assert.equal(files.size, 1);
  assert.ok(
    ["a", "b"].includes((await storage.get("media/photo.png")).body.toString()),
  );
  await storage.put("media/video.mp4", bytes);
  await storage.delete(["media/photo.png", "media/video.mp4", "missing"]);
  assert.equal(files.size, 0);
  assert.equal(await storage.get("missing"), null);
  for (const key of ["../escape", "/absolute", "bad\\path", ""]) {
    await assert.rejects(storage.get(key), /Invalid storage key/);
    await assert.rejects(storage.put(key, bytes), /Invalid storage key/);
    await assert.rejects(storage.delete(key), /Invalid storage key/);
  }
  await storage.close();
  assert.equal(state.closed, true);
});

test("GridFS retains uploads after an ambiguous publication failure", async () => {
  const { storage, files, state } = fixture();
  state.committedFailure = true;
  await assert.rejects(
    storage.put("video", Buffer.from("published")),
    /Publication response lost/,
  );
  assert.equal(files.size, 1);
  assert.equal((await storage.get("video")).body.toString(), "published");
  state.readFailure = true;
  await assert.rejects(
    storage.put("other", Buffer.from("recoverable")),
    /Publication response lost/,
  );
  assert.equal(files.size, 2);
  state.readFailure = false;
  assert.equal((await storage.get("other")).body.toString(), "recoverable");
});

test("GridFS media uses the existing authorized video range endpoint", async () => {
  const { storage } = fixture();
  const bytes = Buffer.from("0123456789");
  await storage.put("video", bytes);
  let authorized = false;
  const DB = {
    prepare: () => ({
      first: async () => null,
      bind: () => ({
        first: async () => ({
          id: "clip",
          type: "video",
          mime: "video/mp4",
          storage_key: "video",
        }),
        all: async () => ({ results: [] }),
      }),
    }),
  };
  const response = await serveMedia(
    new Request("https://cms.example/media/clip", {
      headers: { Range: "bytes=2-5" },
    }),
    { DB, STORAGE: storage },
    "clip",
    async () => {
      authorized = true;
    },
  );
  assert.equal(authorized, true);
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("Content-Range"), "bytes 2-5/10");
  assert.equal(await response.text(), "2345");
});

test("GridFS initializes collections/indexes idempotently and tests without writes", async () => {
  const operations = [];
  let fail = false,
    closed = 0;
  const db = {
    async command() {
      if (fail) throw new Error("private credential");
      operations.push("ping");
    },
    async createCollection(name) {
      operations.push("create:" + name);
      throw Object.assign(new Error("exists"), { code: 48 });
    },
    collection(name) {
      return {
        async findOne() {
          operations.push("read:" + name);
        },
        async createIndex(keys, options) {
          operations.push({ name, keys, options });
        },
      };
    },
  };
  const client = {
    async connect() {},
    db() {
      return db;
    },
    async close() {
      closed++;
    },
  };
  const config = {
    ...connectionDefaults,
    MONGODB_URI: "mongodb://example",
    CMS_STORAGE_PROVIDER: "gridfs",
  };
  const storage = await connectGridFS(config, () => {}, false, client);
  assert.deepEqual(operations, [
    "ping",
    "read:colossal_media.files",
    "read:colossal_media.chunks",
    "read:colossal_media.keys",
  ]);
  await storage.close();
  operations.length = 0;
  await (await connectGridFS(config, () => {}, true, client)).close();
  assert.equal(
    operations.filter((v) => typeof v === "string" && v.startsWith("create:"))
      .length,
    3,
  );
  assert.ok(
    operations.some(
      (v) => v.name === "colossal_media.chunks" && v.options.unique,
    ),
  );
  fail = true;
  await assert.rejects(connectGridFS(config, () => {}, true, client));
  assert.equal(closed, 3);
});

test("GridFS configuration works with D1, requires Mongo credentials, and console awaits storage close", async () => {
  const config = {
    ...connectionDefaults,
    CMS_DB_PROVIDER: "d1",
    CMS_STORAGE_PROVIDER: "gridfs",
    CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
    CLOUDFLARE_D1_DATABASE_ID: "a".repeat(36),
    CLOUDFLARE_API_TOKEN: "secret",
    MONGODB_URI: "mongodb://example",
  };
  validateConnectionConfig(config, true);
  assert.throws(
    () => validateConnectionConfig({ ...config, MONGODB_URI: "" }, true),
    /MONGODB_URI/,
  );
  assert.throws(
    () =>
      validateConnectionConfig({
        ...config,
        MONGODB_GRIDFS_BUCKET: "bad.name",
      }),
    /GridFS/,
  );
  let closed = false;
  const manager = connectionManager({
    hostEnv: config,
    connectors: {
      registerOwner: async () => {},
      seed: async () => {},
      d1: () => ({
        prepare: () => ({ first: async () => ({ connected: 1 }) }),
      }),
      migrate: async () => {},
      gridfs: async (cfg, log, initialize) => {
        assert.equal(initialize, true);
        log("GridFS initialized.");
        return {
          close: async () => {
            closed = true;
          },
        };
      },
    },
  });
  const { id } = await manager.start("initialize");
  for (let i = 0; i < 100 && !manager.job(id).finishedAt; i++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(manager.job(id).status, "completed");
  assert.ok(
    manager
      .job(id)
      .logs.some((entry) => entry.message === "GridFS initialized."),
  );
  assert.equal(closed, true);
});
