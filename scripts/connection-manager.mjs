import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as parseEnv } from "dotenv";
import { connectMongo } from "./mongo-database.mjs";
import { d1Database, migrateD1 } from "./d1-database.mjs";
import { s3Storage } from "./s3-storage.mjs";
import { connectGridFS } from "./gridfs-storage.mjs";
import { connectionFailure } from "./connection-errors.mjs";
import { defaultMongoDnsServers, parseMongoDnsServers } from "./mongo-dns.mjs";
import {
  localMigrationAvailable,
  seedBuiltInData,
  migrateLocalData,
  registerSetupOwner,
} from "./data-migration.mjs";

export const ENV_FIELDS = [
  {
    key: "CMS_SETUP_TOKEN",
    label: "First-run administrator setup token",
    group: "setup",
    secret: true,
  },
  {
    key: "CMS_DB_PROVIDER",
    label: "Production database",
    group: "database",
    default: "mongodb",
    options: ["mongodb", "d1"],
  },
  {
    key: "CMS_STORAGE_PROVIDER",
    label: "Production storage",
    group: "storage",
    default: "gridfs",
    options: ["gridfs", "r2", "local"],
  },
  {
    key: "MONGODB_URI",
    label: "MongoDB connection URI",
    group: "mongodb",
    secret: true,
  },
  {
    key: "MONGODB_DATABASE",
    label: "MongoDB database name",
    group: "mongodb",
    default: "ColossalCMS",
  },
  {
    key: "MONGODB_GRIDFS_BUCKET",
    label: "GridFS bucket name",
    group: "gridfs",
    default: "colossal_media",
  },
  {
    key: "MONGODB_DNS_SERVERS",
    label: "MongoDB DNS servers",
    group: "mongodb",
    default: defaultMongoDnsServers,
  },
  { key: "CLOUDFLARE_ACCOUNT_ID", label: "Cloudflare account ID", group: "d1" },
  { key: "CLOUDFLARE_D1_DATABASE_ID", label: "D1 database ID", group: "d1" },
  {
    key: "CLOUDFLARE_API_TOKEN",
    label: "Cloudflare D1 API token",
    group: "d1",
    secret: true,
  },
  { key: "R2_ENDPOINT", label: "R2 / S3 endpoint", group: "r2" },
  { key: "R2_BUCKET", label: "Bucket name", group: "r2" },
  { key: "R2_REGION", label: "Region", group: "r2", default: "auto" },
  {
    key: "R2_ACCESS_KEY_ID",
    label: "Access key ID",
    group: "r2",
    secret: true,
  },
  {
    key: "R2_SECRET_ACCESS_KEY",
    label: "Secret access key",
    group: "r2",
    secret: true,
  },
  {
    key: "R2_FORCE_PATH_STYLE",
    label: "S3 path-style URLs",
    group: "r2",
    default: "false",
    options: ["false", "true"],
  },
];
export const connectionDefaults = Object.fromEntries(
  ENV_FIELDS.map((f) => [f.key, f.default || ""]),
);
const fail = (message) => {
  throw Object.assign(new Error(message), { status: 400 });
};
export function validateConnectionConfig(config, complete = false) {
  config = { ...config };
  for (const f of ENV_FIELDS) {
    const value = config[f.key];
    if (
      typeof value !== "string" ||
      value.length > 4096 ||
      /[\r\n\0]/.test(value)
    )
      fail("Invalid value for " + f.key);
    if (f.options) {
      // Dotenv removes surrounding quotes; hosting dashboards retain them.
      // Normalize only enum settings, never credentials or database names.
      let option = value.trim();
      if (/^(".*"|'.*')$/.test(option)) option = option.slice(1, -1).trim();
      option = option.toLowerCase();
      if (!f.options.includes(option))
        fail("Set " + f.key + " to one of: " + f.options.join(", ") + ".");
      config[f.key] = option;
    }
  }
  if (config.CMS_SETUP_TOKEN && config.CMS_SETUP_TOKEN.length < 32)
    fail("Use a random administrator setup token of at least 32 characters.");
  if (config.MONGODB_URI && !/^mongodb(?:\+srv)?:\/\//.test(config.MONGODB_URI))
    fail("Use a mongodb:// or mongodb+srv:// connection URI.");
  try {
    parseMongoDnsServers(config.MONGODB_DNS_SERVERS);
  } catch {
    fail(
      "Enter up to four comma-separated DNS server IP addresses, or leave blank for system DNS.",
    );
  }
  if (
    config.MONGODB_DATABASE &&
    !/^[a-zA-Z0-9_-]{1,64}$/.test(config.MONGODB_DATABASE)
  )
    fail(
      "Use letters, numbers, underscores or hyphens for the MongoDB database name.",
    );
  if (
    config.CLOUDFLARE_ACCOUNT_ID &&
    !/^[a-f0-9]{32}$/i.test(config.CLOUDFLARE_ACCOUNT_ID)
  )
    fail("Enter a 32-character Cloudflare account ID.");
  if (
    config.CLOUDFLARE_D1_DATABASE_ID &&
    !/^[a-f0-9-]{36}$/i.test(config.CLOUDFLARE_D1_DATABASE_ID)
  )
    fail("Enter the D1 database UUID.");
  if (config.R2_ENDPOINT) {
    let url;
    try {
      url = new URL(config.R2_ENDPOINT);
    } catch {
      fail("Enter a valid HTTPS storage endpoint.");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      fail(
        "Use an HTTPS endpoint without credentials, paths or query parameters.",
      );
  }
  if (
    config.R2_BUCKET &&
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.R2_BUCKET)
  )
    fail("Enter a valid S3-compatible bucket name.");
  if (
    config.MONGODB_GRIDFS_BUCKET &&
    !/^[a-zA-Z0-9_-]{1,64}$/.test(config.MONGODB_GRIDFS_BUCKET)
  )
    fail(
      "Use letters, numbers, underscores or hyphens for the GridFS bucket name.",
    );
  if (complete) {
    const required =
      config.CMS_DB_PROVIDER === "mongodb"
        ? ["MONGODB_URI", "MONGODB_DATABASE"]
        : [
            "CLOUDFLARE_ACCOUNT_ID",
            "CLOUDFLARE_D1_DATABASE_ID",
            "CLOUDFLARE_API_TOKEN",
          ];
    if (config.CMS_STORAGE_PROVIDER === "r2")
      required.push(
        "R2_ENDPOINT",
        "R2_BUCKET",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
      );
    if (config.CMS_STORAGE_PROVIDER === "gridfs")
      required.push("MONGODB_URI", "MONGODB_DATABASE", "MONGODB_GRIDFS_BUCKET");
    for (const key of required)
      if (!config[key]) fail("Configure " + key + " before connecting.");
  }
  return config;
}

export function connectionManager({
  filename = ".env.production",
  hostEnv = process.env,
  active = { database: "sqlite", storage: "local" },
  connectors = {},
  localDataDir = resolve(".local"),
} = {}) {
  const path = resolve(filename),
    jobs = new Map();
  let saving = false;
  async function fileConfig() {
    try {
      return parseEnv(await readFile(path, "utf8"));
    } catch (e) {
      if (e.code === "ENOENT") return {};
      throw e;
    }
  }
  async function config() {
    const file = await fileConfig();
    return Object.fromEntries(
      ENV_FIELDS.map((f) => [
        f.key,
        hostEnv[f.key] ?? file[f.key] ?? f.default ?? "",
      ]),
    );
  }
  return {
    config,
    async describe() {
      const values = await config();
      return {
        runtime: "node",
        active,
        filename: ".env.production",
        restartRequired: true,
        migration: {
          available: await localMigrationAvailable(localDataDir),
          builtInAutomatic: true,
        },
        fields: ENV_FIELDS.map((f) => ({
          ...f,
          value: f.secret ? "" : values[f.key],
          configured: Boolean(values[f.key]),
          managed: Object.hasOwn(hostEnv, f.key),
        })),
      };
    },
    async save(input) {
      if (saving)
        throw Object.assign(
          new Error("An environment save is already running."),
          { status: 409 },
        );
      saving = true;
      try {
        if (!input || typeof input !== "object" || Array.isArray(input))
          fail("Use an environment configuration object.");
        const next = await config(),
          file = await fileConfig();
        for (const [key, value] of Object.entries(input)) {
          const field = ENV_FIELDS.find((f) => f.key === key);
          if (!field) fail("This environment key cannot be edited.");
          if (Object.hasOwn(hostEnv, key))
            fail(key + " is managed by your hosting environment.");
          if (field.secret && value === "") continue;
          next[key] = value;
          file[key] = value;
        }
        validateConnectionConfig(next);
        const content =
          Object.entries(file)
            .map(([key, value]) => {
              const quote = ['"', "'", "`"].find((q) => !value.includes(q));
              if (!quote)
                fail(
                  "Environment values cannot contain all three quote styles.",
                );
              return key + "=" + quote + value + quote;
            })
            .join("\n") + "\n";
        const temp = path + "." + crypto.randomUUID() + ".tmp";
        try {
          await writeFile(temp, content, { mode: 0o600 });
          await rename(temp, path);
        } catch (e) {
          await unlink(temp).catch(() => {});
          throw e;
        }
        return this.describe();
      } finally {
        saving = false;
      }
    },
    async reveal(key) {
      if (!ENV_FIELDS.some((f) => f.key === key))
        fail("Unknown environment key.");
      return { key, value: (await config())[key] };
    },
    job(id) {
      const job = jobs.get(id);
      if (!job)
        throw Object.assign(new Error("Connection run not found."), {
          status: 404,
        });
      return structuredClone(job);
    },
    async start(action, options = {}) {
      if (
        typeof options.migrateLocal !== "undefined" &&
        typeof options.migrateLocal !== "boolean"
      )
        fail("Choose whether to migrate local data.");
      if (options.migrateLocal && action !== "initialize")
        fail("Local migration requires schema initialization.");
      if (
        options.migrateLocal &&
        !(await localMigrationAvailable(localDataDir))
      )
        fail("Local SQLite data is unavailable on this server.");
      if (!["test", "initialize"].includes(action))
        fail("Choose test or initialize.");
      if ([...jobs.values()].some((j) => j.status === "running"))
        throw Object.assign(
          new Error("A connection run is already in progress."),
          { status: 409 },
        );
      const cfg = validateConnectionConfig(await config(), true),
        id = crypto.randomUUID();
      if (jobs.size >= 20) jobs.delete(jobs.keys().next().value);
      const job = {
        id,
        action,
        migrateLocal: options.migrateLocal === true,
        status: "running",
        startedAt: new Date().toISOString(),
        logs: [],
      };
      jobs.set(id, job);
      const log = (message) => {
        job.logs.push({ time: new Date().toISOString(), message });
      };
      log("Configuration validated. Credentials are excluded from logs.");
      void (async () => {
        let db, storage;
        try {
          if (cfg.CMS_DB_PROVIDER === "mongodb")
            db = await (connectors.mongo || connectMongo)(
              cfg,
              log,
              action === "initialize",
            );
          else {
            log("Connecting to Cloudflare D1…");
            db = (connectors.d1 || d1Database)(cfg);
            await db.prepare("SELECT 1 AS connected").first();
            log("D1 query succeeded.");
            if (action === "initialize")
              await (connectors.migrate || migrateD1)(db, log);
          }
          if (cfg.CMS_STORAGE_PROVIDER === "r2") {
            log("Checking R2 / S3 bucket access…");
            storage = (connectors.storage || s3Storage)(cfg);
            await storage.test();
            log("Bucket access succeeded. No objects were changed.");
          } else if (cfg.CMS_STORAGE_PROVIDER === "gridfs") {
            storage = await (connectors.gridfs || connectGridFS)(
              cfg,
              log,
              action === "initialize",
            );
          } else
            log(
              "Local storage selected. Production requires a persistent disk.",
            );
          if (action === "initialize") {
            if (options.migrateLocal) {
              log(
                "Local migration selected. Completed files/batches are retained after a failure; retrying skips identical data.",
              );
              await (connectors.migrateLocal || migrateLocalData)(
                db,
                storage ||
                  (await import("./local-storage.mjs")).localStorage(
                    resolve(hostEnv.CMS_DATA_DIR || ".production", "storage"),
                  ),
                localDataDir,
                log,
              );
            }
            await (connectors.registerOwner || registerSetupOwner)(
              db,
              localDataDir,
              log,
            );
            await (connectors.seed || seedBuiltInData)(db, log);
          }
          log(
            action === "initialize"
              ? "Schema initialization complete. Restart the production server to use this configuration."
              : "Connection test complete. Database and storage providers were not switched.",
          );
          job.status = "completed";
        } catch (error) {
          job.status = "failed";
          log(connectionFailure(error));
        } finally {
          await Promise.resolve()
            .then(() => db?.close?.())
            .catch(() => {});
          await Promise.resolve()
            .then(() => storage?.close?.())
            .catch(() => {});
          job.finishedAt = new Date().toISOString();
        }
      })();
      return { id };
    },
  };
}
