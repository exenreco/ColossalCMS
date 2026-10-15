import { DatabaseSync } from "node:sqlite";
import { resolve, dirname } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { entries, identity, pillars } from "../content/portfolio/content.mjs";
import { seoDefaults, validateSeo } from "../server/seo.mjs";
const file = resolve(process.argv[2] || ".local/colossal.sqlite");
const db = new DatabaseSync(file);
const backup = resolve(".local", `portfolio-backup-${Date.now()}.sqlite`);
mkdirSync(".local", { recursive: true });
db.prepare("VACUUM INTO ?").run(backup);
let i = 0;
const block = (type, settings = {}, children) => ({
  id: `blk_portfolio_${++i}`,
  type,
  settings,
  ...(children ? { children } : {}),
});
const p = (html) => block("core/paragraph", { html, align: "left" });
const h = (text) => block("core/heading", { text, level: "h2", align: "left" });
const now = new Date().toISOString();
const featuredId = "portfolio-practice-banner";
const imageKey = "media/portfolio/practice-banner.webp";
const imageBytes = readFileSync("public/portfolio/practice-banner.webp");
const imagePath = resolve(dirname(file), "storage", imageKey);
mkdirSync(dirname(imagePath), { recursive: true });
writeFileSync(imagePath, imageBytes);
const cmsLinks = (html) =>
  entries
    .filter((e) => e.kind === "post")
    .reduce((text, e) => {
      const date = new Date(
        db
          .prepare("SELECT publish_at FROM content WHERE id=?")
          .get(`portfolio-${e.slug}`)?.publish_at || now,
      );
      return text.replaceAll(
        `/projects/${e.slug}/`,
        `/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${e.slug}`,
      );
    }, html);
const site = JSON.parse(
  db.prepare("SELECT value FROM config WHERE id='site'").get()?.value || "{}",
);
const settings = {
  ...site,
  title: identity.name,
  tagline: "Web development, technical systems and creative practice.",
  titleFormat: "page-site",
  titleSeparator: "|",
  routingVersion: 2,
  postRouting: "page",
  homePageId: "portfolio-home",
  postsPageId: "portfolio-projects",
  accent: "#2848b8",
};
// Preflight conflicts before any changes; do not replace someone else's authored pages.
for (const e of entries) {
  const old = db
    .prepare("SELECT id FROM content WHERE slug=?")
    .get(e.cmsSlug || e.slug);
  if (old && old.id !== `portfolio-${e.slug}`)
    throw new Error(
      `Existing slug ${e.slug}; resolve the conflict before importing.`,
    );
}
db.exec("BEGIN IMMEDIATE");
try {
  db.prepare(
    `INSERT INTO media (id,type,name,mime,storage_key,alt_text,caption,description,tags,metadata,uploaded_by,uploaded_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET storage_key=excluded.storage_key,metadata=excluded.metadata,updated_at=excluded.updated_at`,
  ).run(
    featuredId,
    "image",
    "Portfolio practice illustration",
    "image/webp",
    imageKey,
    "Conceptual illustration of a browser, servers, a 3D printed object and a camera lens",
    "An illustration of web development, technical systems and creative practice.",
    "Generated editorial portfolio illustration; not a project screenshot or photograph of actual equipment.",
    JSON.stringify(["portfolio", "illustration"]),
    JSON.stringify({ size: imageBytes.length, width: 1536, height: 1024 }),
    identity.name,
    now,
    now,
  );
  for (const e of entries) {
    const blocks = e.sections.flatMap(([title, html]) => [
      h(title),
      p(cmsLinks(html)),
    ]);
    if (e.slug === "home") {
      blocks.unshift(
        block("core/image", {
          source: "url",
          url: "/portfolio/practice-banner.webp",
          alt: "Illustration of web development, infrastructure and creative tools",
          size: "full",
        }),
      );
      blocks.push(
        block(
          "core/columns",
          { gap: 24, stackOnMobile: true },
          pillars.map((x) =>
            block("core/column", { width: "1fr" }, [
              h(x.title),
              p(x.summary),
              p(`<a href="/${x.slug}">Explore ${x.title}</a>`),
            ]),
          ),
        ),
      );
    }
    if (e.slug === "projects")
      blocks.push(
        block("core/post-list", { limit: 12, columns: 3, portfolio: true }, [
          block("core/title", { level: "h2", linkToContent: true }),
          block("core/excerpt", {}),
        ]),
      );
    if (e.repo)
      blocks.push(
        p(
          `<a href="https://github.com/exenreco/${e.repo}">Explore source on GitHub</a>${e.extraRepo ? ` · <a href="https://github.com/exenreco/${e.extraRepo}">Companion repository</a>` : ""}`,
        ),
        p(
          '<a href="/projects">All projects</a> · <a href="/web-development">Web Development pillar</a>',
        ),
      );
    const seo = validateSeo({
      focusKeyword: e.focusKeyword,
      pillarContent:
        e.pillar ||
        ["home", "projects", "about", "background"].includes(e.slug),
      schemaType: e.schema,
      authorName: identity.name,
    });
    const details = {
      contentBlocks: blocks,
      metaTitle: e.metaTitle,
      metaDescription: e.metaDescription,
      featuredImageId: featuredId,
      seo,
      categories: e.category ? [e.category] : [],
      tags: e.tags || [],
      order: entries.indexOf(e),
      panelData:
        e.kind === "post"
          ? {
              portfolioProject: true,
              projectCategory: e.category,
              projectUrl: `https://github.com/exenreco/${e.repo}`,
            }
          : {},
    };
    db.prepare(
      `INSERT INTO content (id,kind,title,slug,excerpt,body,status,publish_at,updated_at,author,details,template_id) VALUES (?,?,?,?,?,?,'published',?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,slug=excluded.slug,excerpt=excluded.excerpt,body=excluded.body,details=excluded.details,updated_at=excluded.updated_at`,
    ).run(
      `portfolio-${e.slug}`,
      e.kind,
      e.title,
      e.cmsSlug || e.slug,
      e.summary,
      e.sections
        .map(([a, b]) => a + "\n" + b.replace(/<[^>]+>/g, ""))
        .join("\n\n"),
      now,
      now,
      identity.name,
      JSON.stringify(details),
      "",
    );
  }
  for (const [id, value] of [
    ["site", settings],
    [
      "seo",
      {
        ...seoDefaults,
        ...JSON.parse(
          db.prepare("SELECT value FROM config WHERE id='seo'").get()?.value ||
            "{}",
        ),
        publisherType: "Person",
        publisherName: identity.name,
        defaultPostSchema: "Article",
      },
    ],
  ])
    db.prepare(
      "INSERT INTO config (id,value) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
    ).run(id, JSON.stringify(value));
  db.prepare(
    "INSERT INTO plugins (id,active,installed) VALUES ('com.colossal.seo',1,1) ON CONFLICT(id) DO UPDATE SET active=1,installed=1",
  ).run();
  // Personalize only the installed portfolio theme; retain core source defaults.
  const row = db
    .prepare("SELECT id,published FROM themes WHERE active=1")
    .get();
  if (row?.id === "com.colossal.theme.colossal-2027") {
    const theme = JSON.parse(row.published);
    const visit = (n) => {
      if (n.settings)
        for (const [k, v] of Object.entries(n.settings))
          if (typeof v === "string")
            n.settings[k] = v
              .replaceAll("/#work", "/projects")
              .replaceAll("/#about", "/about")
              .replaceAll("/#resume", "/background")
              .replaceAll("/#contact", "mailto:" + identity.email);
      (n.children || []).forEach(visit);
    };
    Object.values(theme.parts || {}).forEach(visit);
    // Import page/post records without replacing authored theme templates.
    delete theme.compiled;
    theme.css +=
      "\n.theme-root .c27-section{max-width:1120px;margin-inline:auto;padding:64px 24px}.theme-root .theme-content-title{overflow-wrap:anywhere}.theme-root .c27-header-inner nav a:nth-child(2),.theme-root .c27-header-inner nav a:nth-child(3){display:inline}.theme-root .c27-header-inner nav{flex-wrap:wrap}";
    db.prepare(
      "UPDATE themes SET published=?,revision=revision+1,updated_at=? WHERE id=?",
    ).run(JSON.stringify(theme), now, row.id);
  }
  db.exec("COMMIT");
  console.log(`Imported ${entries.length} entries; backup: ${backup}`);
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
} finally {
  db.close();
}
