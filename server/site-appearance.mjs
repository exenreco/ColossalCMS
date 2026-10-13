/** Preserve legacy identity images when separating logos from browser icons. */
export async function migrateSiteAppearance(db) {
  const row = await db
    .prepare("SELECT value FROM config WHERE id='site'")
    .first();
  if (!row) return;
  const settings = JSON.parse(row.value);
  if (
    !Object.hasOwn(settings, "logo") &&
    settings.adminColorMode &&
    Object.hasOwn(settings, "siteLogoId")
  )
    return;
  const operations = [];
  if (!settings.siteIconId && settings.logo) {
    const url = new URL(settings.logo);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("The existing logo must be a valid HTTPS image URL.");
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(url.href),
    );
    const id =
      "legacy-site-icon-" +
      Array.from(new Uint8Array(digest))
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 20);
    const time = new Date().toISOString();
    operations.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO media (id,type,name,mime,storage_key,alt_text,caption,description,tags,metadata,uploaded_by,uploaded_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          "image",
          "Site icon (previous logo)",
          "image/png",
          "",
          settings.title || "Site icon",
          "",
          "Preserved from the previous Logo URL setting. Replace through the media library to store a local copy.",
          "[]",
          JSON.stringify({ externalUrl: url.href }),
          "migration",
          time,
          time,
        ),
    );
    settings.siteIconId = id;
  }
  if (!Object.hasOwn(settings, "siteLogoId"))
    settings.siteLogoId = settings.siteIconId || "";
  delete settings.logo;
  settings.adminColorMode ||= "system";
  operations.push(
    db
      .prepare("UPDATE config SET value=? WHERE id='site' AND value=?")
      .bind(JSON.stringify(settings), row.value),
  );
  await db.batch(operations);
}
