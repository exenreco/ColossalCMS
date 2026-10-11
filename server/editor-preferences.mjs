/** Preferences are scoped to the authenticated member, never a client-supplied ID. */
export async function editorPreferences(request, db, user) {
  const key = `editor-preferences:${user.id}`;
  const row = await db
    .prepare("SELECT value FROM config WHERE id=?")
    .bind(key)
    .first();
  let stored = {};
  try {
    stored = JSON.parse(row?.value || "{}");
  } catch {
    /* Reset invalid legacy preferences. */
  }
  const preferences = {
    colorMode: stored.colorMode === "light" ? "light" : "dark",
    walkthroughVersion: Number.isInteger(stored.walkthroughVersion)
      ? stored.walkthroughVersion
      : 0,
  };
  if (request.method === "PUT") {
    const body = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (key) => !["colorMode", "walkthroughVersion"].includes(key),
      ) ||
      (body.colorMode !== undefined &&
        !["light", "dark"].includes(body.colorMode)) ||
      (body.walkthroughVersion !== undefined && body.walkthroughVersion !== 1)
    ) {
      return Response.json(
        { error: "Choose valid editor preferences." },
        { status: 400 },
      );
    }
    Object.assign(preferences, body);
    await db
      .prepare(
        "INSERT INTO config (id,value) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
      )
      .bind(key, JSON.stringify(preferences))
      .run();
  } else if (request.method !== "GET") {
    return Response.json(
      { error: "Method not allowed." },
      { status: 405, headers: { Allow: "GET, PUT" } },
    );
  }
  return Response.json(preferences, {
    headers: { "Cache-Control": "no-store" },
  });
}
