import { normalizeIp } from "../server/login-security.mjs";

export function clientIp(req, { vercel = false } = {}) {
  // Vercel overwrites this header. Other hosts use the socket peer; arbitrary
  // forwarding headers are not trusted on local or standalone Node servers.
  if (vercel) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      const ip = normalizeIp(forwarded.split(",")[0]);
      if (ip) return ip;
    }
  }
  return normalizeIp(req.socket?.remoteAddress) || "unknown";
}
