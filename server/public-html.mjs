import { themeLoadingCss } from "../shared/theme-loading.ts";

const esc = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

export function unavailablePublicRender() {
  return {
    status: 503,
    title: "Temporarily unavailable · Colossal CMS",
    description: "Please try again shortly.",
    html: '<main class="public-load-error" role="alert"><h1>We’ll be right back.</h1><p>Content is temporarily unavailable. Please try again.</p><a href="" class="public-load-retry">Try again</a></main>',
    css: ".theme-root{margin:0;background:var(--cl-loading-background);color:var(--cl-loading-color);font-family:system-ui}.theme-root .public-load-error{max-width:640px;margin:15vh auto;padding:32px}.theme-root .public-load-retry{color:var(--cl-loading-accent)}",
    body: { className: "", style: "" },
    adsEnabled: false,
  };
}

/** Embed vetted theme output in the first response and reuse it during Angular bootstrap. */
export function publicHtml(shell, rendered, payloadId = "theme-render") {
  const body = rendered.body || {};
  const initial = JSON.stringify(rendered).replace(/</g, "\\u003c");
  const styles = (themeLoadingCss(rendered.loading) + rendered.css).replace(
    /</g,
    "\\3c ",
  );
  const startup =
    'body[data-cms-enhanced="false"] .cl-ice-world[data-full-viewport="true"]{opacity:0}';
  const banner = rendered.preview
    ? `<div class="theme-preview-banner">${rendered.maintenancePreview ? "Maintenance preview · Administrator only." : "Theme preview · This link expires after 15 minutes."}<a href="/">Exit preview</a></div>`
    : "";
  const announcement = rendered.announcement
    ? `<div class="announcement">${esc(rendered.announcement)}</div>`
    : "";
  let html = shell.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${esc(rendered.title || "Colossal CMS")}</title>`,
  );
  html = html.replace(/<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/gi, "");
  if (rendered.siteIcon)
    html = html.replace(/<link\b(?=[^>]*\brel=["']icon["'])[^>]*>/gi, "");
  return html
    .replace(
      /<\/head>/i,
      `<meta name="description" content="${esc(rendered.description)}">${rendered.siteIcon ? `<link rel="icon" href="${esc(rendered.siteIcon)}">` : ""}<style id="theme-styles">${styles}</style><style id="theme-startup-styles">${startup}</style><noscript><style>${startup.replace("opacity:0", "opacity:1")}</style></noscript><script type="application/json" id="${payloadId}">${initial}</script></head>`,
    )
    .replace(
      /<body[^>]*>/i,
      `<body class="theme-root ${esc(body.className)}" style="${esc(body.style)}" data-block-id="${esc(body.blockId)}" data-theme-id="${esc(body.themeId)}" data-theme-template="${esc(body.templateId)}" data-cms-enhanced="false">`,
    )
    .replace(
      /<cl-frontend[^>]*>[\s\S]*?<\/cl-frontend>/i,
      `<cl-frontend>${banner}${announcement}<div>${rendered.html}</div></cl-frontend>`,
    );
}
