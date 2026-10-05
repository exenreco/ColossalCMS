import { DatabaseSync } from "node:sqlite";
import { access, readdir, readFile, lstat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { productionSchema, rowDefaults } from "./production-schema.mjs";
import { localDatabase } from "./local-database.mjs";
import { initialize } from "../server/worker.mjs";

const tables = Object.keys(productionSchema()).filter(
  (name) => name !== "auth_sessions",
);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function localMigrationAvailable(directory) {
  try {
    await access(join(directory, "colossal.sqlite"));
    return true;
  } catch {
    return false;
  }
}
export async function registerSetupOwner(db, directory, log = () => {}) {
  if (!(await localMigrationAvailable(directory))) {
    log(
      "No local setup administrator available. Use /setup on production if required.",
    );
    return;
  }
  const source = new DatabaseSync(join(directory, "colossal.sqlite"), {
    readOnly: true,
  });
  let owner, credentials;
  try {
    source.exec("BEGIN");
    const present = new Set(
      source
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((row) => row.name),
    );
    if (present.has("members"))
      owner = source.prepare("SELECT * FROM members WHERE id='owner'").get();
    if (present.has("auth_credentials"))
      credentials = source
        .prepare("SELECT * FROM auth_credentials WHERE id='owner'")
        .get();
    source.exec("COMMIT");
  } finally {
    source.close();
  }
  if (!owner || !credentials) {
    log(
      "Local administrator password setup is incomplete. Use /setup on production if required.",
    );
    return;
  }
  if (
    owner.role !== "admin" ||
    !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(credentials.password_hash)
  )
    throw new Error("Local setup administrator credentials are invalid.");
  const existing = await db
    .prepare("SELECT id FROM members WHERE id='owner'")
    .first();
  if (existing) {
    log(
      "Production administrator already exists. Its membership and password were preserved.",
    );
    return;
  }
  const emailMember = await db
    .prepare("SELECT id FROM members WHERE email=?")
    .bind(owner.email)
    .first();
  if (emailMember) {
    log(
      "Administrator registration stopped: its email belongs to another production member. Existing access was preserved.",
    );
    throw new Error("Production administrator email conflict.");
  }
  log(
    "Registering setup administrator in production. Password hash only; no login sessions are copied.",
  );
  await db.batch([
    db
      .prepare("INSERT INTO members (id,email,role) VALUES ('owner',?,'admin')")
      .bind(owner.email),
    db
      .prepare(
        "INSERT INTO auth_credentials (id,password_hash,updated_at) VALUES ('owner',?,?)",
      )
      .bind(credentials.password_hash, credentials.updated_at),
  ]);
  log(
    "Setup administrator registered. Production sign-in uses the same email and password.",
  );
}
export async function seedBuiltInData(
  db,
  log = () => {},
  email = "builtin@colossal.invalid",
) {
  log(
    "Installing built-in themes, plugin catalog, settings and sample content…",
  );
  await initialize(db, { email });
  log("Built-in data ready. Existing records preserved.");
}

export function localSnapshot(directory) {
  const db = new DatabaseSync(join(directory, "colossal.sqlite"), {
    readOnly: true,
  });
  try {
    db.exec("BEGIN");
    const present = new Set(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((row) => row.name),
    );
    const schema = productionSchema();
    const result = Object.fromEntries(
      tables.map((table) => [
        table,
        present.has(table)
          ? db
              .prepare("SELECT * FROM " + table)
              .all()
              .map((row) => ({ ...rowDefaults(schema[table]), ...row }))
          : [],
      ]),
    );
    db.exec("COMMIT");
    return result;
  } finally {
    db.close();
  }
}

async function canonicalSnapshot() {
  const db = localDatabase();
  try {
    await initialize(db, { email: "builtin@colossal.invalid" });
    return Object.fromEntries(
      await Promise.all(
        tables.map(async (table) => [
          table,
          (await db.prepare("SELECT * FROM " + table).all()).results,
        ]),
      ),
    );
  } finally {
    db.close();
  }
}
function equalRow(a, b, columns, builtIn = false) {
  const value = (row, column) =>
    builtIn &&
    typeof row[column] === "string" &&
    ["published", "draft"].includes(column)
      ? row[column].replace(/blk_[a-f0-9-]{36}/gi, "builtin_block")
      : row[column];
  return columns.every(
    (column) =>
      (builtIn &&
        (["updated_at", "created_at", "publish_at"].includes(column) ||
          (column === "author" && a.kind))) ||
      value(a, column) === value(b, column),
  );
}
async function storageFiles(root, prefix = "") {
  const files = [];
  for (const entry of await readdir(join(root, prefix), {
    withFileTypes: true,
  }).catch((error) => {
    if (error.code === "ENOENT" && !prefix) return [];
    throw error;
  })) {
    const key = prefix ? prefix + "/" + entry.name : entry.name;
    if (
      entry.isSymbolicLink() ||
      (await lstat(join(root, key))).isSymbolicLink()
    )
      throw new Error("Local storage cannot contain symbolic links.");
    if (entry.isDirectory()) files.push(...(await storageFiles(root, key)));
    else if (entry.isFile() && !/\.[a-f0-9-]{36}\.tmp$/i.test(key))
      files.push(key);
  }
  return files;
}
function referencedFiles(snapshot) {
  const keys = new Set();
  const document = (text) => {
    if (!text) return;
    const doc = JSON.parse(text);
    for (const asset of Object.values(doc.assets || {}))
      if (asset.key) keys.add(asset.key);
  };
  for (const media of snapshot.media) {
    keys.add(media.storage_key);
    const metadata = JSON.parse(media.metadata);
    if (metadata.posterStorageKey) keys.add(metadata.posterStorageKey);
  }
  for (const version of snapshot.plugin_versions)
    for (const key of JSON.parse(version.files)) keys.add(key);
  for (const theme of snapshot.themes) {
    document(theme.published);
    document(theme.draft);
  }
  for (const history of snapshot.theme_history) document(history.snapshot);
  return keys;
}

export async function migrateLocalData(db, storage, directory, log = () => {}) {
  if (!(await localMigrationAvailable(directory)))
    throw new Error("Local SQLite source is unavailable.");
  log(
    "Reading a consistent local SQLite snapshot. Local data will not be deleted.",
  );
  const snapshot = localSnapshot(directory),
    schema = productionSchema(),
    canonical = await canonicalSnapshot();
  const statements = [];
  const conflict = (table) => {
    log(
      "Migration stopped: production data conflicts in " +
        table +
        ". Existing data preserved; resolve the conflict before retrying.",
    );
    throw new Error("Production migration conflict.");
  };
  for (const table of tables) {
    const columns = schema[table].columns.map((column) => column.name);
    const target = (await db.prepare("SELECT * FROM " + table).all()).results;
    for (const row of snapshot[table]) {
      const existing = target.find((item) => item.id === row.id);
      if (existing && equalRow(row, existing, columns)) continue;
      const builtIn = canonical[table].find((item) => item.id === row.id);
      if (existing && (!builtIn || !equalRow(existing, builtIn, columns, true)))
        conflict(table);
      for (const index of schema[table].indexes.filter((index) => index.unique))
        if (
          index.fields.every((field) => row[field] != null) &&
          target.some(
            (item) =>
              item.id !== row.id &&
              index.fields.every((field) => item[field] === row[field]),
          )
        )
          conflict(table);
      if (existing) {
        const values = columns.filter((column) => column !== "id");
        const where = columns
          .map((column) =>
            existing[column] == null ? column + " IS NULL" : column + "=?",
          )
          .join(" AND ");
        statements.push(
          db
            .prepare(
              "UPDATE " +
                table +
                " SET " +
                values.map((column) => column + "=?").join(",") +
                " WHERE " +
                where,
            )
            .bind(
              ...values.map((column) => row[column]),
              ...columns
                .filter((column) => existing[column] != null)
                .map((column) => existing[column]),
            ),
        );
      } else
        statements.push(
          db
            .prepare(
              "INSERT INTO " +
                table +
                " (" +
                columns.join(",") +
                ") VALUES (" +
                columns.map(() => "?").join(",") +
                ")",
            )
            .bind(...columns.map((column) => row[column])),
        );
    }
    log(
      "Migration preflight: " +
        table +
        " / " +
        snapshot[table].length +
        " local records checked.",
    );
  }
  const root = resolve(directory, "storage"),
    files = await storageFiles(root),
    fileSet = new Set(files);
  for (const key of referencedFiles(snapshot))
    if (!fileSet.has(key)) {
      log("Migration stopped: a referenced local upload is missing.");
      throw new Error("Local upload missing.");
    }
  const uploads = [];
  for (const key of files) {
    const bytes = await readFile(join(root, key)),
      hash = digest(bytes),
      existing = await storage.get(key);
    if (
      existing &&
      digest(Buffer.from(await existing.arrayBuffer())) !== hash
    ) {
      log(
        "Migration stopped: production storage contains a conflicting file. Existing files preserved.",
      );
      throw new Error("Storage migration conflict.");
    }
    if (!existing) uploads.push({ key, hash });
  }
  log(
    "Migration preflight complete. Copying " +
      uploads.length +
      " uploads before database records.",
  );
  for (let i = 0; i < uploads.length; i++) {
    const { key, hash } = uploads[i],
      bytes = await readFile(join(root, key));
    if (digest(bytes) !== hash)
      throw new Error("Local upload changed during migration.");
    await storage.put(key, bytes);
    const copied = await storage.get(key);
    if (!copied || digest(Buffer.from(await copied.arrayBuffer())) !== hash)
      throw new Error("Upload verification failed.");
    log(
      "Migrated and verified upload " + (i + 1) + " of " + uploads.length + ".",
    );
  }
  for (let i = 0; i < statements.length; i += 50) {
    const results = await db.batch(statements.slice(i, i + 50));
    if (
      results.some(
        (result) => Number(result.meta?.changes ?? result.changes) !== 1,
      )
    )
      throw new Error("Production changed during migration.");
    log(
      "Migrated database records: " +
        Math.min(i + 50, statements.length) +
        " of " +
        statements.length +
        ".",
    );
  }
  log(
    "Local migration complete. Existing identical records/files skipped. Login sessions were excluded.",
  );
}
