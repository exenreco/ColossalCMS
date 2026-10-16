import { parse } from "../../server/v2-utils.mjs";
export const webpEligible = (mime) =>
  ["image/png", "image/jpeg", "image/gif"].includes(mime);
export function variantKey(record) {
  const variant = parse(record.metadata).webp;
  return variant?.sourceKey === record.storage_key &&
    variant.storageKey === record.storage_key + ".webp"
    ? variant.storageKey
    : "";
}
export function acceptsWebp(request) {
  if (new URL(request.url).searchParams.get("format") === "original")
    return false;
  return (request.headers.get("Accept") || "").split(",").some((part) => {
    const [type, ...parameters] = part.trim().toLowerCase().split(";");
    const q = parameters.find((parameter) => parameter.trim().startsWith("q="));
    return type === "image/webp" && (!q || Number(q.trim().slice(2)) > 0);
  });
}
export async function createWebpVariant(env, bytes, info, key) {
  if (!env.IMAGE_OPTIMIZER || !webpEligible(info.mime)) return;
  const storageKey = key + ".webp";
  try {
    const output = await env.IMAGE_OPTIMIZER.toWebp(bytes, info.mime);
    if (output === undefined) return;
    if (!output) {
      info.metadata.webpStatus = "skipped";
      return;
    }
    await env.STORAGE.put(storageKey, output.bytes);
    info.metadata.webp = {
      storageKey,
      sourceKey: key,
      mime: "image/webp",
      size: output.bytes.byteLength,
      width: output.width,
      height: output.height,
      pages: output.pages || 1,
    };
    info.metadata.webpStatus = "ready";
  } catch {
    await env.STORAGE.delete(storageKey).catch(() => {});
    info.metadata.webpStatus = "unavailable";
  }
}
const running = new WeakMap();
/** Backfill only after normal media authorization; share concurrent work within an instance. */
export async function ensureWebpVariant(env, record) {
  if (!env.IMAGE_OPTIMIZER || !webpEligible(record.mime) || !record.storage_key)
    return record;
  const metadata = parse(record.metadata);
  if (variantKey(record) || metadata.webpStatus) return record;
  if (!running.has(env.DB)) running.set(env.DB, new Map());
  const tasks = running.get(env.DB),
    key = record.storage_key;
  if (tasks.has(key)) return tasks.get(key);
  const task = (async () => {
    const original = await env.STORAGE.get(key);
    if (!original) return record;
    const info = { mime: record.mime, metadata: { ...metadata } };
    await createWebpVariant(
      env,
      new Uint8Array(await original.arrayBuffer()),
      info,
      key,
    );
    if (!info.metadata.webpStatus) return record;
    try {
      const result = await env.DB.prepare(
        "UPDATE media SET metadata=? WHERE id=? AND storage_key=?",
      )
        .bind(JSON.stringify(info.metadata), record.id, key)
        .run();
      if (Number(result.meta?.changes ?? result.changes) === 0) {
        if (info.metadata.webp)
          await env.STORAGE.delete(info.metadata.webp.storageKey);
        return record;
      }
      return { ...record, metadata: JSON.stringify(info.metadata) };
    } catch {
      if (info.metadata.webp)
        await env.STORAGE.delete(info.metadata.webp.storageKey).catch(() => {});
      return record;
    }
  })();
  tasks.set(key, task);
  try {
    return await task;
  } finally {
    tasks.delete(key);
  }
}
