import { mkdir, writeFile, readFile, unlink, rename } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
/** Filesystem blob adapter with the same get/put/delete contract as the production R2 bucket. */
export function localStorage(root = ".local/storage") {
  const base = resolve(root);
  function path(key) {
    if (
      typeof key !== "string" ||
      key.includes("..") ||
      key.includes("\\") ||
      key.startsWith("/")
    )
      throw new Error("Invalid storage key");
    const p = resolve(base, key);
    if (!p.startsWith(base + sep))
      throw new Error("Storage path escaped its root");
    return p;
  }
  return {
    async put(key, value) {
      const p = path(key);
      await mkdir(dirname(p), { recursive: true });
      const temp = p + "." + crypto.randomUUID() + ".tmp";
      try {
        await writeFile(temp, Buffer.from(value));
        await rename(temp, p);
      } catch (e) {
        await unlink(temp).catch(() => {});
        throw e;
      }
    },
    async get(key) {
      try {
        const b = await readFile(path(key));
        return {
          body: b,
          size: b.byteLength,
          arrayBuffer: async () =>
            b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
        };
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    async delete(key) {
      for (const k of Array.isArray(key) ? key : [key])
        await unlink(path(k)).catch((e) => {
          if (e.code !== "ENOENT") throw e;
        });
    },
  };
}
