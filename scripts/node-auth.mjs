import { loginFormScript } from "./login-form.mjs";
const fail = (message, status) => {
  throw Object.assign(new Error(message), { status });
};
const redirect = (location) =>
  new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store" },
  });

export function authPage(setup = false) {
  const title = setup ? "Create administrator" : "Sign in to Colossal";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Colossal CMS</title><style>*{box-sizing:border-box}body{font:16px system-ui;background:radial-gradient(ellipse at top left,#deeee4,transparent 65%),#f3f7f4;color:#153d31;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}main{padding:36px;background:white;border:1px solid #dbe7df;border-radius:20px;width:min(440px,100%);box-shadow:0 20px 60px #153d3112}h1{font-size:27px;margin:16px 0}p{line-height:1.5;color:#52675e}.brand{font-weight:700;letter-spacing:-.03em}label{display:block;margin:18px 0;font-weight:600}input,button{font:inherit;width:100%;padding:12px;margin-top:8px;border:1px solid #cddbd1;border-radius:8px}input:focus-visible,button:focus-visible{outline:3px solid #82bea2;outline-offset:2px}button{background:#245d47;color:white;font-weight:600;cursor:pointer}button:disabled{opacity:.65;cursor:wait}.show{background:transparent;color:#245d47;padding:6px;border:0;width:auto;font-size:14px;margin:0}#error{color:#9b2929}.hint{font-size:13px;font-weight:400;display:block;margin-top:6px;color:#52675e}</style></head><body><main><div class="brand">colossalCMS</div><h1>${title}</h1>
  <p>${setup ? "Choose the owner’s email and password. Use CMS_SETUP_TOKEN from your hosting environment, or .local/setup-token for local development." : "Sign in to manage your site."}</p>
  <form>${setup ? '<label>Setup token<input name="token" type="password" autocomplete="off" required maxlength="4096"></label>' : ""}
  <label>Email<input name="email" type="email" autocomplete="username" required maxlength="254"></label>
  <label>Password<input name="password" type="password" autocomplete="${setup ? "new-password" : "current-password"}" ${setup ? 'minlength="12"' : ""} required>${setup ? '<span class="hint">At least 12 characters; at most 72 UTF-8 bytes.</span>' : ""}</label>
  <button type="button" class="show" aria-pressed="false">Show password</button>
  ${setup ? '<label>Confirm password<input name="confirm" type="password" autocomplete="new-password" required></label>' : ""}
  <button type="submit">${setup ? "Create administrator" : "Sign in"}</button><p id="error" role="alert" aria-live="polite"></p></form>
  </main><script>${loginFormScript(setup)}</script></body></html>`;
}

export async function handleNodeAuth(request, auth, client = "unknown") {
  const url = new URL(request.url),
    path = url.pathname;
  if (
    ![
      "/login",
      "/setup",
      "/api/auth/login",
      "/api/auth/logout",
      "/api/auth/setup",
    ].includes(path)
  )
    return null;
  if (request.method === "GET" && ["/login", "/setup"].includes(path)) {
    const needed = await auth.setupNeeded();
    if (path === "/setup" && !needed) return redirect("/login");
    if (path === "/login" && needed) return redirect("/setup");
    if (!needed && (await auth.identify(request))) return redirect("/admin/");
    return new Response(authPage(needed), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      },
    });
  }
  if (request.method !== "POST" || !path.startsWith("/api/auth/"))
    fail("Method not allowed.", 405);
  if (request.headers.get("Origin") !== url.origin)
    fail("This request must come from your site.", 403);
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    fail("Use a JSON request.", 415);
  let body;
  try {
    body = await request.json();
  } catch {
    fail("Use a valid JSON request.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail("Use a valid JSON request.", 400);
  let result;
  if (path === "/api/auth/setup") {
    await auth.setup(body.email, body.password, body.token, client);
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (path === "/api/auth/login") {
    try {
      result = await auth.login(body.email, body.password, client);
    } catch (error) {
      if (![401, 429].includes(error.status)) throw error;
      return Response.json(
        {
          error: error.message,
          remainingAttempts: error.remainingAttempts,
          retryAfter: error.retryAfter,
        },
        {
          status: error.status,
          headers: {
            "Cache-Control": "no-store",
            ...(error.retryAfter
              ? { "Retry-After": String(error.retryAfter) }
              : {}),
          },
        },
      );
    }
  } else result = await auth.logout(request);
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": result.cookie, "Cache-Control": "no-store" } },
  );
}
