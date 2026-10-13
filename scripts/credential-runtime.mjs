import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { parse } from "dotenv";

/** Development only: keep the generated key with private local runtime state across restarts. */
export async function localCredentialKey(directory, environment = process.env) {
  if (Object.hasOwn(environment, "CMS_ENCRYPTION_KEY"))
    return environment.CMS_ENCRYPTION_KEY;
  try {
    const config = parse(await readFile(".env.production", "utf8"));
    if (Object.hasOwn(config, "CMS_ENCRYPTION_KEY"))
      return config.CMS_ENCRYPTION_KEY;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const file = resolve(directory, "credential-key");
  try {
    return (await readFile(file, "utf8")).trim();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const key = randomBytes(32).toString("hex");
  try {
    await writeFile(file, key + "\n", { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    return (await readFile(file, "utf8")).trim();
  }
  return key;
}
