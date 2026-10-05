import { getServers, setServers } from "node:dns/promises";
import { isIP } from "node:net";

export const defaultMongoDnsServers = "1.1.1.1,8.8.8.8";
export function parseMongoDnsServers(value = defaultMongoDnsServers) {
  if (typeof value !== "string")
    throw new Error("Use comma-separated DNS server IP addresses.");
  if (!value.trim()) return null;
  const servers = value.split(",").map((server) => server.trim());
  if (servers.length > 4 || servers.some((server) => !isIP(server)))
    throw new Error(
      "Enter up to four comma-separated IPv4 or IPv6 DNS server addresses.",
    );
  return [...new Set(servers)];
}

export function createMongoDnsConfigurator(
  setter = setServers,
  originalServers = getServers(),
) {
  let configured;
  return (config, log = () => {}) => {
    const explicit = parseMongoDnsServers(config.MONGODB_DNS_SERVERS);
    const servers = explicit || originalServers,
      signature = JSON.stringify(servers);
    if (configured && configured !== signature)
      throw Object.assign(
        new Error("Restart Node after changing MongoDB DNS servers."),
        { code: "CMS_DNS_RESTART" },
      );
    // Do not reset DNS while MongoDB's background SRV polling is running.
    if (!configured) {
      setter(servers);
      configured = signature;
    }
    log(
      explicit
        ? "MongoDB DNS configured: " + servers.join(", ") + "."
        : "MongoDB DNS uses the system resolver.",
    );
  };
}
export const configureMongoDNS = createMongoDnsConfigurator();
