import { createHash, timingSafeEqual } from "node:crypto";

export const HEARTBEAT_PATH = "/api/cron/mongodb-heartbeat";
export function authorizeHeartbeat(request, secret) {
  if (request.method !== "GET")
    throw Object.assign(new Error("Method not allowed."), { status: 405 });
  if (typeof secret !== "string" || secret.length < 32)
    throw Object.assign(
      new Error(
        "Configure CRON_SECRET with at least 32 characters before using scheduled heartbeats.",
      ),
      { status: 503 },
    );
  const authorization = request.headers.get("authorization") || "";
  const digest = (value) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(authorization), digest("Bearer " + secret)))
    throw Object.assign(new Error("Unauthorized heartbeat request."), {
      status: 401,
    });
}

export async function heartbeatResponse(env) {
  if (!env.HEARTBEAT)
    return Response.json(
      { skipped: "unavailable" },
      { headers: { "Cache-Control": "no-store" } },
    );
  const result = await env.HEARTBEAT.run({ source: "cron" });
  return Response.json(result, {
    status: result.status === "failed" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export function startHeartbeatScheduler(manager, log = console.error) {
  if (!manager) return () => {};
  let stopped = false,
    busy = false;
  const tick = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      await manager.run({ source: "node-timer" });
    } catch {
      log(
        "MongoDB heartbeat scheduler could not read its configuration. Check provider access.",
      );
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => {
    void tick();
  }, 60000);
  timer.unref();
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
