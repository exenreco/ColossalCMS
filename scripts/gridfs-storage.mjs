import { MongoClient, GridFSBucket } from "mongodb";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { configureMongoDNS } from "./mongo-dns.mjs";

function storageKey(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.includes("..") ||
    value.includes("\\") ||
    value.startsWith("/")
  )
    throw new Error("Invalid storage key.");
  return value;
}

// A single-document pointer publishes only finished uploads, including concurrent replacements.
export function gridfsStorage(
  bucket,
  keys,
  close = async () => {},
  log = () => {},
) {
  const cleanup = async (id) => {
    try {
      await bucket.delete(id);
    } catch (error) {
      // The driver also cleans orphaned chunks when the files document is absent.
      if (
        error.name === "MongoRuntimeError" &&
        /^File not found for id /.test(error.message)
      )
        return;
      log(
        "GridFS file cleanup failed; an unreferenced upload may require cleanup.",
      );
    }
  };
  return {
    async put(key, value) {
      key = storageKey(key);
      const upload = bucket.openUploadStream(key);
      try {
        await pipeline(Readable.from([Buffer.from(value)]), upload);
        const previous = await keys.findOneAndUpdate(
          { _id: key },
          { $set: { fileId: upload.id } },
          {
            upsert: true,
            returnDocument: "before",
            includeResultMetadata: false,
          },
        );
        if (previous) await cleanup(previous.fileId);
      } catch (error) {
        // A network timeout can occur after the pointer update committed. Never
        // remove a potentially published file when its state cannot be verified.
        let referenced = true;
        try {
          const current = await keys.findOne({ _id: key });
          referenced = current?.fileId?.equals
            ? current.fileId.equals(upload.id)
            : current?.fileId === upload.id;
        } catch {
          log(
            "GridFS upload publication could not be verified; file retained for recovery.",
          );
        }
        if (!referenced) await cleanup(upload.id);
        throw error;
      }
    },
    async get(key) {
      const entry = await keys.findOne({ _id: storageKey(key) });
      if (!entry) return null;
      const chunks = [];
      for await (const chunk of bucket.openDownloadStream(entry.fileId))
        chunks.push(chunk);
      const bytes = Buffer.concat(chunks);
      return {
        body: bytes,
        size: bytes.byteLength,
        arrayBuffer: async () =>
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
      };
    },
    async delete(values) {
      for (const value of Array.isArray(values) ? values : [values]) {
        const previous = await keys.findOneAndDelete(
          { _id: storageKey(value) },
          { includeResultMetadata: false },
        );
        if (previous) await bucket.delete(previous.fileId);
      }
    },
    close,
  };
}

export async function connectGridFS(
  config,
  log = () => {},
  initialize = true,
  suppliedClient,
) {
  configureMongoDNS(config, log);
  const client =
    suppliedClient ||
    new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      timeoutMS: 30000,
    });
  try {
    log("Connecting to MongoDB GridFS storage…");
    await client.connect();
    const db = client.db(config.MONGODB_DATABASE);
    await db.command({ ping: 1 });
    const name = config.MONGODB_GRIDFS_BUCKET || "colossal_media";
    const collections = [name + ".files", name + ".chunks", name + ".keys"];
    if (initialize) {
      for (const collection of collections) {
        try {
          await db.createCollection(collection);
        } catch (error) {
          if (error.code !== 48) throw error;
        }
        log("GridFS collection ready: " + collection);
      }
      await db
        .collection(collections[0])
        .createIndex({ filename: 1, uploadDate: 1 });
      await db
        .collection(collections[1])
        .createIndex({ files_id: 1, n: 1 }, { unique: true });
      log("GridFS file, chunk and media-key indexes ready.");
    } else {
      for (const collection of collections)
        await db.collection(collection).findOne({});
      log(
        "GridFS read access succeeded. No files or collections were changed.",
      );
    }
    return {
      ...gridfsStorage(
        new GridFSBucket(db, { bucketName: name }),
        db.collection(collections[2]),
        () => client.close(),
        log,
      ),
      ping: () => db.command({ ping: 1 }, { timeoutMS: 10000 }),
    };
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}
