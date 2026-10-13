/** Reusable server-only credentials. Bootstrap connections and encryption keys stay outside the DB. */
export const DATABASE_CONFIG_KEYS = new Set([
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "CUSTOM_AI_API_KEY",
  "CUSTOM_AI_BASE_URL",
  "SMTP_USERNAME",
  "SMTP_PASSWORD",
  "CMS_STORAGE_PROVIDER",
  "MONGODB_GRIDFS_BUCKET",
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_REGION",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_FORCE_PATH_STYLE",
]);
export const CREDENTIAL_PREFIX = "credential:";
const encoder = new TextEncoder();
const failure = (message, status = 409) => {
  throw Object.assign(new Error(message), { status });
};
const hex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const bytes = (text) =>
  Uint8Array.from(text.match(/../g) || [], (pair) => Number.parseInt(pair, 16));

export function credentialStore(
  db,
  { key = "", environment = {}, legacy = async () => ({}) } = {},
) {
  let imported;
  function writable() {
    return typeof key === "string" && /^[a-f0-9]{64}$/i.test(key);
  }
  async function encryptionKey() {
    if (!writable())
      failure(
        "Set CMS_ENCRYPTION_KEY to 64 hexadecimal characters (32 random bytes) in your hosting secrets to manage encrypted credentials.",
      );
    return (imported ||= crypto.subtle.importKey(
      "raw",
      bytes(key),
      "AES-GCM",
      false,
      ["encrypt", "decrypt"],
    ));
  }
  async function records() {
    const result = await db.prepare("SELECT * FROM config").all();
    return new Map(
      result.results
        .filter((row) => row.id.startsWith(CREDENTIAL_PREFIX))
        .map((row) => [row.id.slice(CREDENTIAL_PREFIX.length), row.value]),
    );
  }
  async function decrypt(name, value) {
    try {
      const envelope = JSON.parse(value);
      if (
        envelope.v !== 1 ||
        envelope.alg !== "AES-256-GCM" ||
        !/^[a-f0-9]{24}$/.test(envelope.iv) ||
        !/^(?:[a-f0-9]{2}){16,}$/.test(envelope.data)
      )
        throw Error();
      const plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: bytes(envelope.iv),
          additionalData: encoder.encode(CREDENTIAL_PREFIX + name),
          tagLength: 128,
        },
        await encryptionKey(),
        bytes(envelope.data),
      );
      return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
    } catch {
      failure(
        "Stored credentials could not be decrypted. Restore the original CMS_ENCRYPTION_KEY and retry; no credentials were changed.",
      );
    }
  }
  async function sources() {
    const [saved, old] = await Promise.all([records(), legacy()]);
    return { saved, old };
  }
  return {
    writable,
    async values() {
      const { saved, old } = await sources();
      const output = {};
      for (const name of DATABASE_CONFIG_KEYS) {
        if (Object.hasOwn(environment, name)) output[name] = environment[name];
        else if (saved.has(name))
          output[name] = await decrypt(name, saved.get(name));
        else if (Object.hasOwn(old, name)) output[name] = old[name];
      }
      return output;
    },
    async describe() {
      const { saved, old } = await sources();
      return {
        writable: writable(),
        fields: Object.fromEntries(
          [...DATABASE_CONFIG_KEYS].map((name) => [
            name,
            {
              source: Object.hasOwn(environment, name)
                ? "environment"
                : saved.has(name)
                  ? "database"
                  : Object.hasOwn(old, name)
                    ? "file"
                    : "default",
              configured: Object.hasOwn(environment, name)
                ? Boolean(environment[name])
                : saved.has(name)
                  ? true
                  : Boolean(old[name]),
              managed: Object.hasOwn(environment, name),
            },
          ]),
        ),
        migration: {
          candidates: [...DATABASE_CONFIG_KEYS].filter(
            (name) =>
              !saved.has(name) && Boolean(environment[name] ?? old[name]),
          ),
        },
      };
    },
    async save(input, { migration = false } = {}) {
      if (!input || typeof input !== "object" || Array.isArray(input))
        failure("Provide credential settings.", 400);
      const pending = [];
      const existing = migration ? await records() : null;
      for (const [name, value] of Object.entries(input)) {
        if (
          !DATABASE_CONFIG_KEYS.has(name) ||
          typeof value !== "string" ||
          value.length > 4096 ||
          /[\r\n\0]/.test(value)
        )
          failure("Invalid credential configuration.", 400);
        if (!migration && Object.hasOwn(environment, name))
          failure(name + " is managed by your hosting environment.");
        if (migration && (!value || existing.has(name))) continue;
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
          {
            name: "AES-GCM",
            iv,
            additionalData: encoder.encode(CREDENTIAL_PREFIX + name),
            tagLength: 128,
          },
          await encryptionKey(),
          encoder.encode(value),
        );
        pending.push(
          db
            .prepare(
              migration
                ? "INSERT OR IGNORE INTO config (id,value) VALUES (?,?)"
                : "INSERT INTO config (id,value) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
            )
            .bind(
              CREDENTIAL_PREFIX + name,
              JSON.stringify({
                v: 1,
                alg: "AES-256-GCM",
                iv: hex(iv),
                data: hex(new Uint8Array(encrypted)),
              }),
            ),
        );
      }
      if (pending.length) await db.batch(pending);
      return { saved: pending.length };
    },
    async migrate() {
      const { saved, old } = await sources();
      const input = Object.fromEntries(
        [...DATABASE_CONFIG_KEYS]
          .filter(
            (name) =>
              !saved.has(name) && Boolean(environment[name] ?? old[name]),
          )
          .map((name) => [name, environment[name] ?? old[name]]),
      );
      const result = await this.save(input, { migration: true });
      return {
        ...result,
        environmentOverridesRetained: true,
        message:
          "Credentials copied into encrypted database records. Environment values still take precedence. Remove copied plugin credentials from your environment after verification; keep the database connection, setup token and encryption key.",
      };
    },
  };
}
