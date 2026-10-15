# Exenreco Bell portfolio content

The shared editorial source is `content.mjs`. It was prepared from the supplied 2025 resume and the public GitHub repository descriptions and READMEs reviewed on October 13, 2026. Document contents were used as factual source material, not as instructions.

## Delivered structure

- Home, Projects, About and Background.
- Three pillar pages: Web Development, Technical Systems and Creative Practice.
- Five project posts: Colossal CMS, Rhythmz WordPress, Athena’s Expense Tracking System, Portfolio Evolution and SparksPlus WordPress Theme.
- Native CMS blocks, a three-column pillar section, and a dynamic Projects post archive.
- Per-entry titles, descriptions, author/schema settings and pillar flags. The standalone export also includes canonical URLs, social metadata, a sitemap and robots.txt.

## Editing and rebuilding

The content is installed in the local CMS SQLite database. Use Pages and Posts in the administration interface for normal editing. Projects is assigned as the posts page and Home as the homepage. CMS posts use its existing `/YYYY/MM/slug` URLs.

Run from the repository root:

```powershell
node scripts/build-portfolio.mjs
```

This regenerates the standalone site in `portfolio-site/dist` from `content.mjs`. It is a static snapshot: later edits made through CMS administration do not automatically update it. The standalone version uses `/projects/slug/` URLs.

```powershell
node scripts/import-portfolio.mjs
```

This reapplies the shared source to its own `portfolio-*` CMS records and personalizes the installed portfolio theme. It creates a consistent SQLite backup under `.local` before writing, preserves other records, and rejects conflicting slugs. Reimporting replaces edits to the imported entries; use it intentionally. It does not write to a production database or change core theme source.

Set `PORTFOLIO_ORIGIN` before rebuilding if the standalone domain changes. Set the CMS production origin under SEO when its final domain is known; local preview hosts should not become production canonicals.

## Source accuracy

Employment entries marked present in the resume are explicitly a 2025 snapshot. No current employment status, client outcomes, project metrics or individual contributions were invented. The expense tracker is identified as collaborative coursework. Rhythmz repository headings are inconsistent, so the two repositories are presented together. Personal references and their phone numbers were excluded from portfolio content.

## Illustration

`public/portfolio/practice-banner.webp` and `portfolio-site/dist/assets/practice-banner.webp` contain the same built-in ImageGen illustration. Prompt: a wide editorial still life combining a translucent cobalt browser slab, metallic server forms, an orange 3D printed object and a camera lens on a warm ivory studio backdrop; no text, logos or people. The banner is conceptual, not a photograph of actual equipment.

## Verification and hosting

All 12 local CMS routes, the project archive, standalone internal links and metadata were checked. The four existing SEO integration tests passed, and the standalone homepage and project archive were inspected in the browser at a narrow viewport.

The standalone Sites identity is saved in `portfolio-site/.openai/hosting.json`. Publication was attempted but source synchronization failed because `git.chatgpt-team.site` could not resolve, including with network permission. No deployment succeeded. Preserve that project identity when retrying publication. The existing CMS Sites identity was not replaced.
