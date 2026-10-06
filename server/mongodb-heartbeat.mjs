import { connectionFailure } from "../scripts/connection-errors.mjs";

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const defaults = { enabled: false, intervalDays: 1 };
export function mongodbHeartbeat({
  db,
  ping,
  mode = "local",
  cronConfigured = false,
  clock = () => Date.now(),
  log = () => {},
}) {
  const iso = () => new Date(clock()).toISOString();
  async function settings() {
    const row = await db
      .prepare("SELECT value FROM config WHERE id='mongodb-heartbeat'")
      .first();
    return { ...defaults, ...(row ? JSON.parse(row.value) : {}) };
  }
  async function state() {
    const row = await db
      .prepare("SELECT value FROM config WHERE id='mongodb-heartbeat-status'")
      .first();
    return row
      ? JSON.parse(row.value)
      : { status: "never", lastAttemptAt: null, lastSuccessAt: null };
  }
  async function active() {
    return !!(
      await db
        .prepare(
          "SELECT active FROM plugins WHERE id='com.colossal.production-connections'",
        )
        .first()
    )?.active;
  }
  function nextDue(policy, previous) {
    if (!previous.lastSuccessAt) return null;
    const day = Math.floor(Date.parse(previous.lastSuccessAt) / 86400000);
    return new Date((day + policy.intervalDays) * 86400000).toISOString();
  }
  return {
    async describe() {
      const policy = await settings(),
        previous = await state();
      const { leaseUntil, ...publicState } = previous;
      return {
        settings: policy,
        state: publicState,
        supported: typeof ping === "function",
        mode,
        cronConfigured,
        schedulerReady:
          mode === "node" || (mode === "vercel" && cronConfigured),
        active: await active(),
        nextDueAt: nextDue(policy, previous),
      };
    },
    async save(input) {
      if (typeof input?.enabled !== "boolean")
        fail("Choose whether the MongoDB heartbeat is enabled.");
      if (
        !Number.isInteger(input.intervalDays) ||
        input.intervalDays < 1 ||
        input.intervalDays > 14
      )
        fail("Choose a heartbeat interval between 1 and 14 days.");
      const policy = {
        enabled: input.enabled,
        intervalDays: input.intervalDays,
      };
      await db
        .prepare(
          "INSERT INTO config (id,value) VALUES ('mongodb-heartbeat',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
        )
        .bind(JSON.stringify(policy))
        .run();
      return policy;
    },
    async run({ force = false, source = "scheduled" } = {}) {
      if (!(await active())) return { skipped: "plugin-inactive" };
      const policy = await settings();
      if (!force && !policy.enabled) return { skipped: "disabled" };
      if (typeof ping !== "function") {
        if (force)
          fail(
            "Heartbeat requires a running MongoDB database or MongoDB GridFS storage provider.",
            409,
          );
        return { skipped: "not-mongodb" };
      }
      await db
        .prepare(
          "INSERT OR IGNORE INTO config (id,value) VALUES ('mongodb-heartbeat-status','{}')",
        )
        .run();
      const row = await db
        .prepare("SELECT value FROM config WHERE id='mongodb-heartbeat-status'")
        .first();
      const previous = JSON.parse(row.value);
      if (previous.leaseUntil && Date.parse(previous.leaseUntil) > clock())
        return { skipped: "already-running" };
      if (!force) {
        const due = nextDue(policy, previous);
        if (due && Date.parse(due) > clock()) return { skipped: "not-due" };
        if (
          previous.status === "failed" &&
          clock() - Date.parse(previous.lastAttemptAt) < 3600000
        )
          return { skipped: "retry-backoff" };
      }
      const start = clock();
      const claimed = {
        ...previous,
        status: "running",
        lastAttemptAt: iso(),
        source,
        leaseUntil: new Date(start + 600000).toISOString(),
      };
      const claimValue = JSON.stringify(claimed);
      const claim = await db
        .prepare(
          "UPDATE config SET value=? WHERE id='mongodb-heartbeat-status' AND value=?",
        )
        .bind(claimValue, row.value)
        .run();
      if ((claim.meta?.changes ?? claim.changes) !== 1)
        return { skipped: "already-running" };
      let result;
      try {
        // Unlike /healthz, this always sends a real command to MongoDB.
        await ping();
        result = {
          ...claimed,
          status: "success",
          lastSuccessAt: iso(),
          durationMs: Math.max(0, clock() - start),
          message: "MongoDB ping succeeded.",
          leaseUntil: "",
        };
      } catch (error) {
        result = {
          ...claimed,
          status: "failed",
          durationMs: Math.max(0, clock() - start),
          message: connectionFailure(error),
          leaseUntil: "",
        };
      }
      log("MongoDB heartbeat: " + result.message);
      try {
        await db
          .prepare(
            "UPDATE config SET value=? WHERE id='mongodb-heartbeat-status' AND value=?",
          )
          .bind(JSON.stringify(result), claimValue)
          .run();
      } catch {
        // A database outage can also prevent storing its failure status.
        log("MongoDB heartbeat status could not be persisted.");
      }
      const { leaseUntil, ...publicResult } = result;
      return publicResult;
    },
  };
}
