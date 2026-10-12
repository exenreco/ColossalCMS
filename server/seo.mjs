import { SCHEMA_TYPES, SEO_ID } from "../shared/seo.ts";
import { formatPageTitle } from "../shared/page-title.ts";
export const seoDefaults = {
  siteUrl: "",
  publisherType: "Organization",
  publisherName: "",
  publisherLogo: "",
  defaultPostSchema: "BlogPosting",
  defaultPageSchema: "WebPage",
  breadcrumbs: true,
  indexNowEnabled: false,
  indexNowKey: "",
};
const esc = (value) =>
  String(value || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const invalid = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};
const text = (value, max) => {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > max)
    invalid("SEO fields exceed their supported length.");
  return value.trim();
};
const url = (value) => {
  const result = text(value, 2048);
  if (
    result &&
    (!/^https?:\/\//i.test(result) ||
      (() => {
        try {
          const parsed = new URL(result);
          return !!(parsed.username || parsed.password);
        } catch {
          return true;
        }
      })())
  )
    invalid(
      "SEO URLs must be absolute HTTP or HTTPS URLs without credentials.",
    );
  return result;
};
export function validateSeo(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    invalid("Invalid SEO options.");
  const result = {};
  for (const [key, max] of Object.entries({
    focusKeyword: 160,
    socialTitle: 200,
    socialDescription: 500,
    schemaName: 200,
    authorName: 200,
  }))
    result[key] = text(input[key], max);
  for (const key of ["canonical", "socialImage"]) result[key] = url(input[key]);
  for (const key of ["noindex", "nofollow", "pillarContent"]) {
    if (input[key] !== undefined && typeof input[key] !== "boolean")
      invalid("Invalid SEO indexing option.");
    result[key] = input[key] ?? false;
  }
  result.schemaType = input.schemaType || "Automatic";
  if (!SCHEMA_TYPES.includes(result.schemaType))
    invalid("Choose a supported schema type.");
  if (
    input.faq !== undefined &&
    (!Array.isArray(input.faq) || input.faq.length > 30)
  )
    invalid("Use up to 30 FAQ entries.");
  result.faq = (input.faq || []).map((item) => {
    if (!item || typeof item !== "object")
      invalid("Check FAQ questions and answers.");
    const question = text(item.question, 500),
      answer = text(item.answer, 5000);
    if (!question || !answer) invalid("Each FAQ needs a question and answer.");
    return { question, answer };
  });
  return result;
}
export function validateSeoSettings(input) {
  if (!input || typeof input !== "object") invalid("Invalid SEO settings.");
  const settings = {
    siteUrl: url(input.siteUrl),
    publisherLogo: url(input.publisherLogo),
    publisherName: text(input.publisherName, 200),
    publisherType: input.publisherType,
    defaultPostSchema: input.defaultPostSchema,
    defaultPageSchema: input.defaultPageSchema,
    breadcrumbs: input.breadcrumbs,
    indexNowEnabled: input.indexNowEnabled ?? false,
    indexNowKey: text(input.indexNowKey, 128),
  };
  if (
    !["Person", "Organization"].includes(settings.publisherType) ||
    typeof settings.breadcrumbs !== "boolean" ||
    !SCHEMA_TYPES.includes(settings.defaultPostSchema) ||
    !SCHEMA_TYPES.includes(settings.defaultPageSchema) ||
    [settings.defaultPostSchema, settings.defaultPageSchema].includes(
      "Automatic",
    )
  )
    invalid("Check the default SEO schema settings.");
  if (
    [settings.defaultPostSchema, settings.defaultPageSchema].includes("FAQPage")
  )
    invalid(
      "Configure FAQ schema on individual entries with visible questions and answers.",
    );
  if (settings.siteUrl) {
    const site = new URL(settings.siteUrl);
    if (
      (site.pathname !== "/" && site.pathname !== "") ||
      site.search ||
      site.hash
    )
      invalid(
        "Production site URL must be an origin, such as https://example.com.",
      );
    settings.siteUrl = site.origin;
  }
  if (
    typeof settings.indexNowEnabled !== "boolean" ||
    (settings.indexNowKey &&
      !/^[a-zA-Z0-9-]{8,128}$/.test(settings.indexNowKey))
  )
    invalid("IndexNow needs a key of 8–128 letters, numbers or hyphens.");
  if (
    settings.indexNowEnabled &&
    (!settings.siteUrl ||
      !settings.siteUrl.startsWith("https://") ||
      !settings.indexNowKey)
  )
    invalid(
      "Set the HTTPS production site URL and generate a key before enabling IndexNow.",
    );
  return settings;
}
export async function readSeoSettings(db) {
  const row = await db
    .prepare("SELECT value FROM config WHERE id='seo'")
    .first();
  return { ...seoDefaults, ...JSON.parse(row?.value || "{}") };
}
export async function indexNowKeyFile(db, path) {
  const plugin = await db
    .prepare("SELECT active FROM plugins WHERE id=?")
    .bind(SEO_ID)
    .first();
  if (!plugin?.active) return null;
  const settings = await readSeoSettings(db);
  if (
    !settings.indexNowEnabled ||
    !/^[a-zA-Z0-9-]{8,128}$/.test(settings.indexNowKey) ||
    path !== `/${settings.indexNowKey}.txt`
  )
    return null;
  return new Response(settings.indexNowKey, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function submitIndexNow(db, request, contentId, send = fetch) {
  const plugin = await db
    .prepare("SELECT active FROM plugins WHERE id=?")
    .bind(SEO_ID)
    .first();
  if (!plugin?.active)
    invalid("Activate Advanced SEO before submitting URLs.", 409);
  const settings = await readSeoSettings(db);
  if (!settings.indexNowEnabled || !settings.siteUrl || !settings.indexNowKey)
    invalid("Configure and enable IndexNow in SEO settings first.", 409);
  const origin = new URL(request.url).origin;
  if (settings.siteUrl !== origin || !origin.startsWith("https://"))
    invalid(
      "Submit from the configured production site, after deployment.",
      409,
    );
  if (typeof contentId !== "string" || contentId.length > 160)
    invalid("Choose a page or post to submit.");
  const row = await db
    .prepare("SELECT * FROM content WHERE id=?")
    .bind(contentId)
    .first();
  if (!row) invalid("Content not found.", 404);
  const details = JSON.parse(row.details || "{}");
  const site = await db
    .prepare("SELECT value FROM config WHERE id='site'")
    .first();
  const roles = JSON.parse(site?.value || "{}");
  if (
    row.status !== "published" ||
    (row.publish_at && new Date(row.publish_at).getTime() > Date.now()) ||
    details.seo?.noindex ||
    row.id === roles.notFoundPageId
  )
    invalid("Only published, indexable pages and posts can be submitted.");
  const date = new Date(row.publish_at);
  const path =
    row.id === roles.homePageId
      ? "/"
      : row.kind === "post"
        ? `/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${row.slug}`
        : "/" + row.slug;
  const target = details.seo?.canonical || new URL(path, origin).href;
  if (new URL(target).origin !== origin)
    invalid("This entry's canonical URL points to another site.");
  let response;
  try {
    response = await send("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: new URL(origin).host,
        key: settings.indexNowKey,
        keyLocation: new URL(`/${settings.indexNowKey}.txt`, origin).href,
        urlList: [target],
      }),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
  } catch {
    invalid("IndexNow could not be reached. Try again later.", 502);
  }
  if (![200, 202].includes(response.status)) {
    const messages = {
      400: "IndexNow rejected the submission format.",
      403: "IndexNow could not verify the key file. Check the public key URL in SEO settings.",
      422: "IndexNow rejected the URL or key. Check the production domain and key file.",
      429: "IndexNow rate limit reached. Try again later.",
    };
    invalid(
      messages[response.status] ||
        "IndexNow is temporarily unavailable. Try again later.",
      response.status === 429 ? 429 : 502,
    );
  }
  return {
    submitted: true,
    provider: "IndexNow",
    status: response.status,
    url: target,
    message:
      response.status === 202
        ? "IndexNow received the URL; key verification is pending. Indexing is not guaranteed."
        : "URL submitted to IndexNow. Indexing is not guaranteed.",
  };
}

export async function seoMetadata(db, ctx, origin, preview = false) {
  if (preview || !ctx.plugins.some((p) => p.id === SEO_ID)) return {};
  const settings = await readSeoSettings(db);
  const entry = ctx.content?.id ? ctx.content : null;
  const options = entry?.details?.seo || {};
  const base = settings.siteUrl || origin;
  const canonical = options.canonical || new URL(ctx.path, base).href;
  const title = entry?.details?.metaTitle || entry?.title || ctx.settings.title;
  const description =
    entry?.details?.metaDescription ||
    entry?.excerpt ||
    ctx.settings.tagline ||
    "";
  const robots = `${options.noindex || ctx.kind === "404" || ctx.kind === "search" ? "noindex" : "index"}, ${options.nofollow ? "nofollow" : "follow"}`;
  const image =
    options.socialImage ||
    (entry?.details?.featuredImageId
      ? new URL(
          `/api/media/${encodeURIComponent(entry.details.featuredImageId)}/file`,
          base,
        ).href
      : "");
  const publisher = {
    "@type": settings.publisherType,
    name: settings.publisherName || ctx.settings.title,
    ...(settings.publisherLogo
      ? { logo: { "@type": "ImageObject", url: settings.publisherLogo } }
      : {}),
  };
  const graph = [
    {
      "@type": "WebSite",
      "@id": new URL("/#website", base).href,
      url: base,
      name: ctx.settings.title,
      publisher,
    },
  ];
  const type =
    options.schemaType && options.schemaType !== "Automatic"
      ? options.schemaType
      : entry?.kind === "post"
        ? settings.defaultPostSchema
        : settings.defaultPageSchema;
  if (ctx.kind !== "404" && ctx.kind !== "search" && type !== "None") {
    const node = {
      "@type": type,
      "@id": canonical + "#content",
      url: canonical,
      name: options.schemaName || title,
      description,
      isPartOf: { "@id": new URL("/#website", base).href },
    };
    if (["Article", "BlogPosting"].includes(type))
      Object.assign(node, {
        headline: options.schemaName || title,
        ...(entry?.publishAt ? { datePublished: entry.publishAt } : {}),
        ...(entry?.updatedAt ? { dateModified: entry.updatedAt } : {}),
        ...(options.authorName
          ? { author: { "@type": "Person", name: options.authorName } }
          : {}),
        publisher,
        ...(image ? { image: [image] } : {}),
        mainEntityOfPage: canonical,
      });
    if (type === "ProfilePage" && options.authorName)
      node.mainEntity = { "@type": "Person", name: options.authorName };
    if (type === "FAQPage")
      node.mainEntity = (options.faq || []).map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      }));
    if (type !== "FAQPage" || node.mainEntity.length) graph.push(node);
    if (settings.breadcrumbs && ctx.path !== "/")
      graph.push({
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: ctx.settings.title,
            item: base,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: entry?.title || title,
            item: canonical,
          },
        ],
      });
  }
  return {
    seo: {
      canonical,
      robots,
      socialTitle:
        options.socialTitle ||
        formatPageTitle(entry ? title : "", ctx.settings),
      socialDescription: options.socialDescription || description,
      image,
      type: entry?.kind === "post" ? "article" : "website",
      siteName: ctx.settings.title,
      graph,
    },
  };
}
export function seoHead(seo) {
  if (!seo) return "";
  const meta = (property, value, attribute = "property") =>
    `<meta ${attribute}="${property}" content="${esc(value)}" data-cms-seo>`;
  return `<link rel="canonical" href="${esc(seo.canonical)}" data-cms-seo>${meta("robots", seo.robots, "name")}${meta("og:title", seo.socialTitle)}${meta("og:description", seo.socialDescription)}${meta("og:url", seo.canonical)}${meta("og:type", seo.type)}${meta("og:site_name", seo.siteName)}${meta("twitter:card", seo.image ? "summary_large_image" : "summary", "name")}${meta("twitter:title", seo.socialTitle, "name")}${meta("twitter:description", seo.socialDescription, "name")}${seo.image ? meta("og:image", seo.image) + meta("twitter:image", seo.image, "name") : ""}<script type="application/ld+json" data-cms-seo>${JSON.stringify({ "@context": "https://schema.org", "@graph": seo.graph }).replace(/</g, "\\u003c")}</script>`;
}

/** Search discovery includes only public, indexable entries; never drafts or 404 assignments. */
export async function seoDiscovery(db, request) {
  const requestUrl = new URL(request.url);
  const plugin = await db
    .prepare("SELECT active FROM plugins WHERE id=?")
    .bind(SEO_ID)
    .first();
  if (!plugin?.active) return null;
  const settings = await readSeoSettings(db);
  const base = settings.siteUrl || requestUrl.origin;
  if (requestUrl.pathname === "/robots.txt")
    return new Response(
      `User-agent: *\nDisallow: /admin/\nDisallow: /api/\nDisallow: /login\nDisallow: /setup\nSitemap: ${new URL("/sitemap.xml", base).href}\n`,
      { headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  const site = await db
    .prepare("SELECT value FROM config WHERE id='site'")
    .first();
  const roles = JSON.parse(site?.value || "{}");
  const rows = (
    await db.prepare("SELECT * FROM content WHERE status='published'").all()
  ).results;
  const urls = new Set([new URL("/", base).href]);
  for (const row of rows) {
    const details = JSON.parse(row.details || "{}");
    if (
      details.seo?.noindex ||
      row.id === roles.notFoundPageId ||
      (row.publish_at && new Date(row.publish_at).getTime() > Date.now())
    )
      continue;
    const date = new Date(row.publish_at);
    const path =
      row.id === roles.homePageId
        ? "/"
        : row.kind === "post"
          ? `/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${row.slug}`
          : "/" + row.slug;
    const canonical = details.seo?.canonical || new URL(path, base).href;
    if (new URL(canonical).origin === new URL(base).origin) urls.add(canonical);
  }
  const home = rows.find((row) => row.id === roles.homePageId);
  if (home && JSON.parse(home.details || "{}").seo?.noindex)
    urls.delete(new URL("/", base).href);
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...urls].map((url) => `<url><loc>${esc(url)}</loc></url>`).join("")}</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
