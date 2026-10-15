const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const short = (value, length = 200) =>
  typeof value === "string" ? value.trim().slice(0, length) : "";
const safeUrl = (value) => {
  try {
    const url = new URL(short(value, 2000));
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
};
export function renderProjectDetails(settings, content) {
  const data =
    settings.source === "custom"
      ? settings
      : {
          projectType:
            content?.details?.panelData?.projectType ||
            content?.details?.panelData?.projectCategory,
          year: content?.details?.panelData?.projectYear,
          technologies: content?.details?.panelData?.projectTechnologies,
          liveUrl: content?.details?.panelData?.projectLiveUrl,
          repositoryUrl: content?.details?.panelData?.projectRepositoryUrl,
        };
  const rows = [];
  if (settings.showType !== false && short(data.projectType))
    rows.push(
      `<li><span class="theme-project-label">Project type</span><span>${escape(short(data.projectType))}</span></li>`,
    );
  if (settings.showYear !== false && short(data.year))
    rows.push(
      `<li><span class="theme-project-label">Year</span><span>${escape(short(data.year, 40))}</span></li>`,
    );
  const technologies = [
    ...new Set(
      short(data.technologies, 1000)
        .split(",")
        .map((item) => item.trim().slice(0, 60))
        .filter(Boolean),
    ),
  ].slice(0, 20);
  if (settings.showTechnologies !== false && technologies.length)
    rows.push(
      `<li><span class="theme-project-label">Technologies</span><span class="theme-project-technologies">${technologies.map((item) => `<span>${escape(item)}</span>`).join("")}</span></li>`,
    );
  const links = [];
  if (settings.showLinks !== false) {
    const attrs =
      settings.openNewTab !== false
        ? ' target="_blank" rel="noopener noreferrer"'
        : "";
    for (const [value, label] of [
      [data.liveUrl, "View live site"],
      [data.repositoryUrl, "View source"],
    ]) {
      const href = safeUrl(value);
      if (href)
        links.push(
          `<a href="${escape(href)}"${attrs}>${label} <span aria-hidden="true">↗</span></a>`,
        );
    }
  }
  if (!rows.length && !links.length) return "";
  return `<section class="theme-project-details"><h3>${escape(short(settings.title) || "Project details")}</h3><ul>${rows.join("")}</ul><div class="theme-project-links">${links.join("")}</div></section>`;
}
export function renderTableOfContents(settings) {
  const min = Math.max(
    1,
    Math.min(
      4,
      Number(String(settings.minLevel || "h2").replace("h", "")) || 2,
    ),
  );
  const max = Math.max(
    min,
    Math.min(
      6,
      Number(String(settings.maxLevel || "h3").replace("h", "")) || 3,
    ),
  );
  const offset = Math.max(
    0,
    Math.min(300, Number(settings.scrollOffset ?? 120) || 0),
  );
  return `<nav class="theme-toc" aria-label="${escape(short(settings.title) || "On this page")}" data-toc-min="${min}" data-toc-max="${max}" data-toc-offset="${offset}" data-toc-highlight="${settings.highlightCurrent !== false}" data-toc-numbered="${settings.numbered === true}"><h3>${escape(short(settings.title) || "On this page")}</h3><div class="theme-toc-links"></div></nav>`;
}
export const SIDEBAR_BLOCK_CSS = `
.theme-root .theme-toc h3,.theme-root .theme-project-details h3{font-size:18px;line-height:26px;letter-spacing:-0.4px;margin:0 0 18px}
.theme-root .theme-toc ul,.theme-root .theme-toc ol,.theme-root .theme-project-details ul{margin:0;padding:0;list-style:none}
.theme-root .theme-toc ol{list-style:decimal;padding-left:20px}
.theme-root .theme-toc li{margin:0 0 12px;font-size:14px;line-height:21px}
.theme-root .theme-toc a{color:inherit;opacity:0.65;display:block}
.theme-root .theme-toc a[aria-current]{opacity:1;color:#56df95}
.theme-root .theme-toc li.toc-nested{padding-left:14px}
.theme-root .theme-project-details li{display:flex;flex-direction:column;gap:6px;margin:0 0 18px;font-size:14px;line-height:21px}
.theme-root .theme-project-label{font-size:11px;letter-spacing:1px;opacity:0.6}
.theme-root .theme-project-technologies{display:flex;flex-wrap:wrap;gap:6px}
.theme-root .theme-project-technologies>span{padding:4px 9px;border:1px solid #8899aa40;border-radius:8px;font-size:12px}
.theme-root .theme-project-links{display:flex;flex-direction:column;gap:12px;font-size:14px;line-height:21px}
`;
