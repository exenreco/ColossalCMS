export const CACHE_ID = "com.colossal.caching";
export const CACHE_SLOTS = 64;
export const MAX_ENTRY_BYTES = 512 * 1024;
export const defaults = {
  enabled: true,
  ttl: 300,
  cachePages: true,
  cacheApi: true,
  excludedPaths: [],
};
export function validateSettings(value = {}) {
  const ttl = Number(value.ttl ?? defaults.ttl);
  if (!Number.isInteger(ttl) || ttl < 30 || ttl > 3600)
    throw Object.assign(
      new Error("Cache lifetime must be between 30 and 3600 seconds."),
      { status: 400 },
    );
  const paths = value.excludedPaths ?? [];
  if (
    !Array.isArray(paths) ||
    paths.length > 50 ||
    paths.some(
      (path) =>
        typeof path !== "string" ||
        !/^\/(?!\/)[^?#\\\s]*$/.test(path) ||
        path.length > 250,
    )
  )
    throw Object.assign(
      new Error(
        "Enter up to 50 site paths, one per line. Paths must start with /.",
      ),
      { status: 400 },
    );
  return {
    enabled: value.enabled !== false,
    ttl,
    cachePages: value.cachePages !== false,
    cacheApi: value.cacheApi !== false,
    excludedPaths: [...new Set(paths)],
  };
}
