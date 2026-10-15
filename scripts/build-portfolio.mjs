import { mkdir, writeFile, copyFile } from "node:fs/promises";
import {
  entries,
  identity,
  pillars,
  projects,
  pathFor,
} from "../content/portfolio/content.mjs";
const root = new URL("../portfolio-site/dist/", import.meta.url);
const origin =
  process.env.PORTFOLIO_ORIGIN ||
  "https://exenreco-portfolio.ardent-bow-4506.chatgpt.site";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const cards = (items) =>
  `<div class="cards">${items.map((p, i) => `<article class="card"><span class="number">${String(i + 1).padStart(2, "0")} / ${esc(p.category || "AREA OF PRACTICE")}</span><h2><a href="${pathFor(p)}">${esc(p.title)} <span aria-hidden="true">↗</span></a></h2><p>${esc(p.summary)}</p>${p.tags ? `<p class="tags">${p.tags.map(esc).join(" · ")}</p>` : ""}</article>`).join("")}</div>`;
await mkdir(root, { recursive: true });
await writeFile(
  new URL("style.css", root),
  `:root{color-scheme:light;--paper:#f6f3ec;--ink:#202421;--blue:#2848b8;--line:#d4d6ce}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.7 system-ui,sans-serif}a{color:var(--blue);text-underline-offset:4px}a:hover{text-decoration-thickness:2px}a:focus-visible{outline:3px solid #c4511e;outline-offset:5px}.skip{position:absolute;top:-100px}.skip:focus{top:8px;background:white;padding:12px;z-index:10}header,main,footer{max-width:1240px;margin:auto;padding:32px 48px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);gap:24px}.brand{font-weight:800;letter-spacing:-1px;color:var(--ink);text-decoration:none;font-size:23px}nav{display:flex;gap:28px;flex-wrap:wrap}nav a{font-size:14px;color:var(--ink);text-decoration:none}nav a[aria-current=page]{color:var(--blue);text-decoration:underline}.eyebrow,.number{font:12px/1.5 ui-monospace,monospace;text-transform:uppercase;letter-spacing:2px;color:var(--blue)}.hero{padding:64px 0 42px;max-width:950px}h1{font-size:clamp(42px,6vw,84px);line-height:1.06;letter-spacing:-.055em;margin:20px 0 28px}h2{line-height:1.25;letter-spacing:-.025em;font-size:30px}p{margin:0 0 22px}.lead{max-width:790px;font-size:23px;color:#4d554f}.banner{width:100%;height:410px;object-fit:cover;border-radius:3px;display:block}.caption{font-size:12px;color:#59615b;margin-top:8px}.sections{max-width:850px}.sections section{padding:32px 0;border-bottom:1px solid var(--line)}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin:40px 0 64px}.card{padding:28px 0;border-top:2px solid var(--ink)}.card h2{font-size:27px}.card h2 a{color:var(--ink);text-decoration:none}.card h2 a:hover{color:var(--blue)}.card h2 span{color:var(--blue)}.tags{font-size:12px;color:#59615b}.source{padding:24px 0}.back{font-size:14px}.cta{display:flex;justify-content:space-between;gap:20px;align-items:center;margin:60px 0;padding:34px;background:#e6e9de}.button{display:inline-block;padding:13px 22px;background:var(--blue);color:white;text-decoration:none;white-space:nowrap}footer{border-top:1px solid var(--line);font-size:13px;display:flex;justify-content:space-between;gap:20px}.footer-links{display:flex;gap:20px;flex-wrap:wrap}@media(max-width:760px){header,main,footer{padding:24px}header,footer{align-items:flex-start;flex-direction:column}nav{gap:20px}.hero{padding-top:36px}.lead{font-size:20px}.cards{grid-template-columns:1fr;gap:10px}.banner{height:280px}.cta{flex-direction:column;align-items:flex-start;padding:24px}h2{font-size:26px}}`,
);
for (const entry of entries) {
  const path = pathFor(entry),
    title = `${entry.metaTitle} | Exenreco Bell`;
  const image = origin + "/assets/practice-banner.webp";
  const schema = {
    "@context": "https://schema.org",
    "@type": entry.schema,
    name: entry.title,
    description: entry.metaDescription,
    url: origin + path,
    ...(entry.kind === "post"
      ? {
          headline: entry.title,
          author: {
            "@type": "Person",
            name: identity.name,
            url: origin + "/about/",
          },
        }
      : {
          about: {
            "@type": "Person",
            name: identity.name,
            url: origin + "/about/",
            sameAs: [identity.github],
          },
        }),
  };
  const sections = entry.sections
    .map(([h, p]) => `<section><h2>${esc(h)}</h2><p>${p}</p></section>`)
    .join("");
  const related =
    entry.kind === "post"
      ? `<p class="back"><a href="/projects/">← All projects</a> · <a href="/web-development/">Web Development pillar</a></p>`
      : "";
  const sources = entry.repo
    ? `<aside class="source" aria-label="Project source"><a class="button" href="https://github.com/exenreco/${entry.repo}">Explore source on GitHub ↗</a>${entry.extraRepo ? ` <a href="https://github.com/exenreco/${entry.extraRepo}">Companion repository ↗</a>` : ""}</aside>`
    : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(entry.metaDescription)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${origin + path}"><meta property="og:type" content="${entry.kind === "post" ? "article" : "website"}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(entry.metaDescription)}"><meta property="og:url" content="${origin + path}"><meta property="og:site_name" content="Exenreco Bell"><meta property="og:image" content="${image}"><meta property="og:image:alt" content="Illustration of web, infrastructure and creative tools"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(entry.metaDescription)}"><meta name="twitter:image" content="${image}"><link rel="stylesheet" href="/style.css"><script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script></head><body><a class="skip" href="#main">Skip to content</a><header><a class="brand" href="/">Exenreco Bell<span aria-hidden="true">.</span></a><nav aria-label="Main navigation">${[
    ["projects", "Projects"],
    ["about", "About"],
    ["background", "Background"],
  ]
    .map(
      ([slug, label]) =>
        `<a href="/${slug}/"${entry.slug === slug ? ' aria-current="page"' : ""}>${label}</a>`,
    )
    .join(
      "",
    )}<a href="mailto:${identity.email}">Get in touch ↗</a></nav></header><main id="main">${related}<div class="hero"><span class="eyebrow">${entry.kind === "post" ? esc(entry.category) : "Omaha, Nebraska / Portfolio"}</span><h1>${esc(entry.title)}</h1><p class="lead">${esc(entry.metaDescription)}</p></div>${entry.slug === "home" ? '<img class="banner" src="/assets/practice-banner.webp" width="1536" height="1024" alt="Conceptual illustration of a browser, servers, a printed object and a camera lens"><p class="caption">An illustration of the practices behind the work.</p>' : ""}<div class="sections">${sections}${sources}</div>${entry.slug === "projects" ? cards(projects.map((p) => ({ ...p, kind: "post" }))) : ""}${entry.slug === "home" ? cards(pillars.map((p) => ({ ...p, kind: "page" }))) : ""}<div class="cta"><div><span class="eyebrow">Have a project in mind?</span><h2>Let’s start a conversation.</h2></div><a class="button" href="mailto:${identity.email}">Email Exenreco ↗</a></div></main><footer><span>© ${new Date().getFullYear()} Exenreco Bell</span><div class="footer-links">${pillars.map((p) => `<a href="/${p.slug}/">${esc(p.title)}</a>`).join("")}<a href="${identity.github}">GitHub ↗</a></div></footer></body></html>`;
  const dir = new URL("." + path, root);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL("index.html", dir), html);
}
await writeFile(
  new URL("sitemap.xml", root),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map((e) => `<url><loc>${origin + pathFor(e)}</loc></url>`).join("")}</urlset>`,
);
await writeFile(
  new URL("robots.txt", root),
  `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
);
await writeFile(
  new URL("404.html", root),
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found | Exenreco Bell</title><link rel="stylesheet" href="/style.css"><main><h1>Page not found</h1><p><a href="/">Return home</a> or <a href="/projects/">explore projects</a>.</p></main></html>',
);
await writeFile(
  new URL("../content/portfolio/entries.json", import.meta.url),
  JSON.stringify(entries, null, 2) + "\n",
);
console.log(`Built ${entries.length} portfolio pages in portfolio-site/dist.`);
