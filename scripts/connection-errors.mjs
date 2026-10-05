// Classify errors into fixed messages. Never interpolate provider text or credentials.
export function connectionFailure(error) {
  const errors = [],
    seen = new Set();
  function visit(value) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    errors.push(value);
    visit(value.cause);
    visit(value.reason);
    if (value.servers instanceof Map)
      for (const server of value.servers.values()) visit(server.error);
  }
  visit(error);
  const has = (predicate) => errors.some(predicate);
  if (has((e) => e.code === "CMS_DNS_RESTART"))
    return "MongoDB DNS servers changed. Restart the Node server before testing or connecting again.";
  if (
    has(
      (e) =>
        e.code === 18 ||
        e.codeName === "AuthenticationFailed" ||
        (e.code === 8000 &&
          /bad auth|authentication failed|auth failed/i.test(e.message || "")),
    )
  )
    return "MongoDB authentication failed. Check the database user's username/password and authSource in the connection URI. URL-encode special characters in credentials.";
  if (
    has(
      (e) =>
        e.code === 13 ||
        e.codeName === "Unauthorized" ||
        (e.code === 8000 &&
          /not authorized|not allowed|permission|unauthorized/i.test(
            e.message || "",
          )),
    )
  )
    return "MongoDB denied this operation. Grant the database user permissions to read/write the selected database and create collections, validators and indexes.";
  if (
    has(
      (e) =>
        (typeof e.syscall === "string" &&
          /^query(?:Srv|Txt|A|Aaaa)$/.test(e.syscall) &&
          ["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET"].includes(e.code)) ||
        [
          "ENOTFOUND",
          "ENODATA",
          "ESERVFAIL",
          "EREFUSED",
          "EAI_AGAIN",
          "ETIMEOUT",
        ].includes(e.code),
    )
  )
    return "MongoDB DNS lookup failed or was refused. Verify the cluster hostname and DNS/VPN/firewall access to SRV and TXT records. If SRV queries are blocked, use Atlas's standard mongodb:// connection string instead.";
  if (
    has((e) =>
      [
        "CERT_HAS_EXPIRED",
        "DEPTH_ZERO_SELF_SIGNED_CERT",
        "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
        "ERR_TLS_CERT_ALTNAME_INVALID",
        "SELF_SIGNED_CERT_IN_CHAIN",
      ].includes(e.code),
    )
  )
    return "MongoDB TLS certificate validation failed. Check the system clock, trusted certificates and any network proxy. TLS verification remains enabled.";
  if (has((e) => e.code === "CMS_MONGO_REPLICA_SET"))
    return "MongoDB connected, but this server is standalone. Use Atlas or a replica set because CMS publishing and revisions require transactions.";
  if (has((e) => e.code === 11000 || e.codeName === "DuplicateKey"))
    return "MongoDB found duplicate values while creating a unique index. Resolve conflicting existing records before initializing again.";
  if (has((e) => e.code === 121 || e.codeName === "DocumentValidationFailure"))
    return "MongoDB rejected data that does not match the CMS schema. Check existing records and their field types before retrying.";
  if (
    has(
      (e) =>
        e.name === "MongoParseError" || e.name === "MongoInvalidArgumentError",
    )
  )
    return "MongoDB connection URI is invalid. Copy the driver's connection string, replace its placeholders and URL-encode username/password characters.";
  if (
    has(
      (e) =>
        e.name === "MongoServerSelectionError" ||
        e.name === "MongoNetworkError" ||
        ["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET"].includes(e.code),
    )
  )
    return "MongoDB could not reach a usable server. Check Atlas Network Access for this server's outbound IP, cluster availability, firewall rules and the URI hostname.";
  return "Connection run failed. Check provider configuration and permissions. Raw provider errors are withheld to protect secrets.";
}
