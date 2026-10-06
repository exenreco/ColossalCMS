export const LOGIN_SECURITY_ID = "com.colossal.login-security";
export const loginSecurityDefaults = {
  enabled: true,
  maxAttempts: 10,
  windowMinutes: 15,
  blockMinutes: 30,
  retentionDays: 7,
};
const fail = (message, status = 400, details = {}) => {
  throw Object.assign(new Error(message), { status, ...details });
};

export function normalizeIp(value) {
  if (typeof value !== "string" || value.length > 64) return null;
  const ip = value.trim().toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split(".").map(Number);
    return parts.every((part) => part <= 255) ? parts.join(".") : null;
  }
  if (!/^[a-f\d:.]+$/.test(ip) || !ip.includes(":")) return null;
  try {
    const normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    const mapped = normalized.match(/^::ffff:([a-f\d]+):([a-f\d]+)$/);
    if (mapped) {
      const first = parseInt(mapped[1], 16),
        second = parseInt(mapped[2], 16);
      return [first >> 8, first & 255, second >> 8, second & 255].join(".");
    }
    return normalized;
  } catch {
    return null;
  }
}

export function validateLoginSecurity(settings) {
  if (
    !settings ||
    typeof settings !== "object" ||
    typeof settings.enabled !== "boolean"
  )
    fail("Choose whether login protection is enabled.");
  const result = { enabled: settings.enabled };
  for (const [key, max] of Object.entries({
    maxAttempts: 100,
    windowMinutes: 1440,
    blockMinutes: 10080,
    retentionDays: 90,
  })) {
    if (
      !Number.isInteger(settings[key]) ||
      settings[key] < 1 ||
      settings[key] > max
    )
      fail(`Set ${key} to a whole number between 1 and ${max}.`);
    result[key] = settings[key];
  }
  return result;
}

export function loginSecurity(
  db,
  { clock = () => Date.now(), uuid = () => crypto.randomUUID() } = {},
) {
  const iso = () => new Date(clock()).toISOString();
  async function settings() {
    const row = await db
      .prepare("SELECT value FROM config WHERE id='login-security'")
      .first();
    return validateLoginSecurity({
      ...loginSecurityDefaults,
      ...(row ? JSON.parse(row.value) : {}),
    });
  }
  async function active() {
    const plugin = await db
      .prepare("SELECT active FROM plugins WHERE id=?")
      .bind(LOGIN_SECURITY_ID)
      .first();
    return !!plugin?.active;
  }
  async function event(ip, email, outcome) {
    await db
      .prepare(
        "INSERT INTO login_events (id,ip,email,outcome,created_at) VALUES (?,?,?,?,?)",
      )
      .bind(
        uuid(),
        ip,
        typeof email === "string"
          ? email.trim().toLowerCase().slice(0, 254)
          : "",
        outcome,
        iso(),
      )
      .run();
  }
  async function cleanup(policy) {
    const expired = (
      await db
        .prepare(
          "SELECT ip,expires_at FROM login_ip_blocks WHERE expires_at!='' AND expires_at<=?",
        )
        .bind(iso())
        .all()
    ).results;
    await db.batch([
      ...expired.map((row) =>
        db
          .prepare("DELETE FROM login_ip_windows WHERE ip=? AND last_at<=?")
          .bind(row.ip, row.expires_at),
      ),
      db
        .prepare(
          "DELETE FROM login_ip_blocks WHERE expires_at!='' AND expires_at<=?",
        )
        .bind(iso()),
      db
        .prepare("DELETE FROM login_events WHERE created_at<?")
        .bind(
          new Date(clock() - policy.retentionDays * 86400000).toISOString(),
        ),
      db
        .prepare("DELETE FROM login_ip_windows WHERE last_at<?")
        .bind(
          new Date(clock() - policy.retentionDays * 86400000).toISOString(),
        ),
    ]);
  }
  async function block(ip) {
    return db
      .prepare(
        "SELECT * FROM login_ip_blocks WHERE id=? AND (expires_at='' OR expires_at>?)",
      )
      .bind(ip, iso())
      .first();
  }
  async function automaticBlock(ip, policy) {
    const until = new Date(clock() + policy.blockMinutes * 60000).toISOString();
    await db
      .prepare(
        "INSERT OR IGNORE INTO login_ip_blocks (id,ip,source,reason,created_at,expires_at) VALUES (?,?,'automatic',?,?,?)",
      )
      .bind(ip, ip, "Login attempt limit reached", iso(), until)
      .run();
    return block(ip);
  }
  function blockedError(record) {
    const retryAfter = record.expires_at
      ? Math.max(1, Math.ceil((Date.parse(record.expires_at) - clock()) / 1000))
      : undefined;
    fail(
      record.expires_at
        ? "Too many sign-in attempts. This IP address is temporarily blocked. Try again after the countdown."
        : "Sign-in from this IP address is blocked. Contact your administrator.",
      429,
      { retryAfter },
    );
  }
  return {
    settings,
    active,
    async begin(client, email) {
      const policy = await settings();
      if (!(await active()) || !policy.enabled) return { active: false };
      const ip = normalizeIp(client) || "unknown";
      await cleanup(policy);
      const existing = await block(ip);
      if (existing) {
        await event(ip, email, "blocked");
        blockedError(existing);
      }
      const id =
        ip + ":" + Math.floor(clock() / (policy.windowMinutes * 60000));
      // Reserve attempts atomically before bcrypt so simultaneous requests cannot
      // bypass the limit on multiple serverless instances.
      await db.batch([
        db
          .prepare(
            "INSERT OR IGNORE INTO login_ip_windows (id,ip,attempts,failures,successes,first_at,last_at) VALUES (?,?,0,0,0,?,?)",
          )
          .bind(id, ip, iso(), iso()),
        db
          .prepare(
            "UPDATE login_ip_windows SET attempts=attempts+1,last_at=? WHERE id=?",
          )
          .bind(iso(), id),
      ]);
      const row = await db
        .prepare("SELECT attempts FROM login_ip_windows WHERE id=?")
        .bind(id)
        .first();
      if (row.attempts > policy.maxAttempts) {
        const record = await automaticBlock(ip, policy);
        await event(ip, email, "blocked");
        blockedError(record);
      }
      return { active: true, id, ip, policy, email };
    },
    async finish(ticket, success) {
      if (!ticket.active) return {};
      const { id, ip, policy, email } = ticket;
      if (success) {
        const existing = await block(ip);
        if (existing) {
          await event(ip, email, "blocked");
          blockedError(existing);
        }
        await db
          .prepare(
            "UPDATE login_ip_windows SET attempts=0,successes=successes+1,last_at=? WHERE id=?",
          )
          .bind(iso(), id)
          .run();
        await event(ip, email, "success");
        return {};
      }
      await db
        .prepare(
          "UPDATE login_ip_windows SET failures=failures+1,last_at=? WHERE id=?",
        )
        .bind(iso(), id)
        .run();
      await event(ip, email, "failed");
      const row = await db
        .prepare("SELECT attempts FROM login_ip_windows WHERE id=?")
        .bind(id)
        .first();
      if (row && row.attempts >= policy.maxAttempts)
        blockedError(await automaticBlock(ip, policy));
      return {
        remainingAttempts: Math.max(
          0,
          policy.maxAttempts - (row?.attempts || 0),
        ),
      };
    },
    async overview(currentIp) {
      const policy = await settings();
      await cleanup(policy);
      return {
        settings: policy,
        active: await active(),
        currentIp: normalizeIp(currentIp),
        blocks: (
          await db
            .prepare(
              "SELECT * FROM login_ip_blocks ORDER BY created_at DESC LIMIT 200",
            )
            .all()
        ).results,
        windows: (
          await db
            .prepare(
              "SELECT * FROM login_ip_windows ORDER BY last_at DESC LIMIT 200",
            )
            .all()
        ).results,
        events: (
          await db
            .prepare(
              "SELECT * FROM login_events ORDER BY created_at DESC LIMIT 200",
            )
            .all()
        ).results,
      };
    },
    async save(input) {
      const policy = validateLoginSecurity(input);
      await db
        .prepare(
          "INSERT INTO config (id,value) VALUES ('login-security',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
        )
        .bind(JSON.stringify(policy))
        .run();
      return policy;
    },
    async addBlock(input, currentIp) {
      const ip = normalizeIp(input?.ip);
      if (!ip)
        fail(
          "Enter a valid IPv4 or IPv6 address. Address ranges are not supported.",
        );
      if (ip === normalizeIp(currentIp))
        fail("You cannot block your current IP address from this session.");
      if (typeof input.reason !== "string" || input.reason.length > 300)
        fail("Use a block reason of at most 300 characters.");
      if (
        !Number.isInteger(input.minutes) ||
        input.minutes < 0 ||
        input.minutes > 525600
      )
        fail(
          "Use 0 for a permanent block, or a duration of up to 525600 minutes.",
        );
      const until = input.minutes
        ? new Date(clock() + input.minutes * 60000).toISOString()
        : "";
      await db
        .prepare(
          "INSERT INTO login_ip_blocks (id,ip,source,reason,created_at,expires_at) VALUES (?,?,'manual',?,?,?) ON CONFLICT(id) DO UPDATE SET source=excluded.source,reason=excluded.reason,created_at=excluded.created_at,expires_at=excluded.expires_at",
        )
        .bind(ip, ip, input.reason.trim(), iso(), until)
        .run();
    },
    async removeBlock(input) {
      const ip = normalizeIp(input?.ip);
      if (!ip) fail("Enter a valid IPv4 or IPv6 address.");
      await db.batch([
        db.prepare("DELETE FROM login_ip_blocks WHERE id=?").bind(ip),
        db.prepare("DELETE FROM login_ip_windows WHERE ip=?").bind(ip),
      ]);
    },
  };
}

export async function handleLoginSecurity(request, env, user) {
  if (user.role !== "admin")
    fail("Only admins can manage login security.", 403);
  const manager = loginSecurity(env.DB);
  const path = new URL(request.url).pathname;
  const currentIp =
    request.headers.get("x-cms-client-ip") ||
    (!env.PASSWORD_AUTH ? request.headers.get("cf-connecting-ip") : null);
  let result;
  if (request.method === "GET" && path === "/api/admin/login-security")
    result = {
      ...(await manager.overview(currentIp)),
      passwordAuth: !!env.PASSWORD_AUTH,
    };
  else if (request.method === "POST") {
    const body = await request.json();
    if (path === "/api/admin/login-security/settings")
      result = await manager.save(body);
    else if (path === "/api/admin/login-security/block") {
      await manager.addBlock(body, currentIp);
      result = { ok: true };
    } else if (path === "/api/admin/login-security/unblock") {
      await manager.removeBlock(body);
      result = { ok: true };
    }
  }
  if (!result) fail("Login security operation not found.", 404);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
