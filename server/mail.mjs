const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
export const mailDefaults = {
  enabled: false,
  provider: "mail2world",
  host: "",
  port: 587,
  encryption: "starttls",
  fromEmail: "",
  fromName: "",
  replyTo: "",
};
const emailPattern = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;
export function mailAddress(value) {
  if (
    typeof value !== "string" ||
    value.length > 254 ||
    /[\r\n\0]/.test(value) ||
    !emailPattern.test(value)
  )
    fail("Enter a valid email address.");
  return value;
}
export function validateMailSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("Check the SMTP settings.");
  const result = Object.fromEntries(
    Object.keys(mailDefaults).map((key) => [
      key,
      input[key] ?? mailDefaults[key],
    ]),
  );
  if (
    typeof result.enabled !== "boolean" ||
    !["mail2world", "custom"].includes(result.provider) ||
    !["starttls", "tls"].includes(result.encryption)
  )
    fail("Choose a valid SMTP provider and encryption mode.");
  if (!Number.isInteger(result.port) || result.port < 1 || result.port > 65535)
    fail("Enter a port between 1 and 65535.");
  for (const key of ["host", "fromEmail", "fromName", "replyTo"]) {
    if (
      typeof result[key] !== "string" ||
      result[key].length > 254 ||
      /[\r\n\0]/.test(result[key])
    )
      fail("Check the SMTP " + key + ".");
    result[key] = result[key].trim();
  }
  if (
    result.host &&
    !/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(
      result.host,
    )
  )
    fail("Enter an SMTP hostname without a URL, path, or credentials.");
  if (result.fromEmail) mailAddress(result.fromEmail);
  if (result.replyTo) mailAddress(result.replyTo);
  if (result.enabled && (!result.host || !result.fromEmail))
    fail("Add an SMTP host and From email before enabling mail.");
  return result;
}
export async function readMailSettings(db) {
  const row = await db
    .prepare("SELECT value FROM config WHERE id='smtp'")
    .first();
  return validateMailSettings({
    ...mailDefaults,
    ...(row ? JSON.parse(row.value) : {}),
  });
}
export async function saveMailSettings(db, settings) {
  const valid = validateMailSettings(settings);
  await db
    .prepare(
      "INSERT INTO config (id,value) VALUES ('smtp',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
    )
    .bind(JSON.stringify(valid))
    .run();
  return valid;
}

/** The shared capability for trusted server plugins; no unauthenticated send-mail API. */
export async function sendSiteMail(env, message) {
  if (!env.MAIL)
    fail("SMTP sending requires the Node hosting mail adapter.", 503);
  return env.MAIL.send(message);
}
