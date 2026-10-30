import { PlayError, readiness } from "./service.mjs";

export const credentialFields = {
  publicKey: "MEDIA_MANAGER_PLAY_PUBLIC_KEY",
  audience: "MEDIA_MANAGER_PLAY_WIF_AUDIENCE",
  serviceAccount: "MEDIA_MANAGER_PLAY_SERVICE_ACCOUNT",
};

export async function readConfiguration(env, replacements = {}) {
  const values = env.CREDENTIALS ? await env.CREDENTIALS.values() : {};
  const config = { ...(env.MEDIA_MANAGER_PLAY || {}) };
  for (const [field, name] of Object.entries(credentialFields)) {
    if (values[name] !== undefined) config[field] = values[name];
    if (replacements[field] !== undefined) config[field] = replacements[field];
  }
  return config;
}

export async function credentialStatus(env) {
  const description = env.CREDENTIALS ? await env.CREDENTIALS.describe() : null;
  const config = env.MEDIA_MANAGER_PLAY || {};
  return {
    storageWritable: description?.writable === true,
    credentials: Object.fromEntries(
      Object.entries(credentialFields).map(([field, name]) => [
        field,
        description?.fields[name] || {
          configured: !!config[field],
          managed: !!config[field],
          source: config[field] ? "environment" : "default",
        },
      ]),
    ),
  };
}

export async function validateCredentialUpdates(input) {
  if (input === undefined) return {};
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((field) => !Object.hasOwn(credentialFields, field))
  )
    throw new PlayError("Provide only the three Play verification fields.");
  const updates = {};
  for (const [field, value] of Object.entries(input)) {
    if (
      typeof value !== "string" ||
      value.length > 4096 ||
      value.includes("\0")
    )
      throw new PlayError("Invalid Play verification field.");
    // Empty inputs preserve existing ciphertext. Placeholder masks are never values.
    if (!value.trim()) continue;
    const clean =
      field === "publicKey" ? value.replace(/\s/g, "") : value.trim();
    if (field === "publicKey") {
      try {
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) throw Error();
        const key = await crypto.subtle.importKey(
          "spki",
          Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)),
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-1" },
          false,
          ["verify"],
        );
        if (key.algorithm.modulusLength < 2048) throw Error();
      } catch {
        throw new PlayError(
          "Enter the Base64 RSA licensing public key from Play Console (2048 bits or stronger).",
        );
      }
    } else {
      const candidate = {
        audience:
          "//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/cms/providers/host",
        serviceAccount: "verifier@example-project.iam.gserviceaccount.com",
        identityToken: () => "",
        [field]: clean,
      };
      if (!readiness(candidate).identityConfigured)
        throw new PlayError(
          field === "audience"
            ? "Enter the Google workload identity provider audience beginning //iam.googleapis.com/projects/."
            : "Enter the verifier service account email ending .iam.gserviceaccount.com.",
        );
    }
    updates[field] = clean;
  }
  return updates;
}

export async function saveCredentials(env, replacements) {
  if (!Object.keys(replacements).length) return;
  if (!env.CREDENTIALS?.writable())
    throw new PlayError(
      "Configure CMS_ENCRYPTION_KEY in your hosting secrets before saving encrypted verification settings.",
      409,
    );
  await env.CREDENTIALS.save(
    Object.fromEntries(
      Object.entries(replacements).map(([field, value]) => [
        credentialFields[field],
        value,
      ]),
    ),
  );
}
