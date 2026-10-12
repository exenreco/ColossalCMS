import type { Content } from "./models";
// @ts-ignore Node 24 loads this shared helper directly; Angular resolves the same source.
import { formatPageTitle, type TitleSettings } from "./page-title.ts";

export const SEO_ID = "com.colossal.seo";
export const SCHEMA_TYPES = [
  "Automatic",
  "None",
  "WebPage",
  "Article",
  "BlogPosting",
  "AboutPage",
  "ContactPage",
  "ProfilePage",
  "FAQPage",
] as const;
export interface SeoOptions {
  pillarContent?: boolean;
  focusKeyword?: string;
  canonical?: string;
  noindex?: boolean;
  nofollow?: boolean;
  socialTitle?: string;
  socialDescription?: string;
  socialImage?: string;
  schemaType?: string;
  schemaName?: string;
  authorName?: string;
  faq?: { question: string; answer: string }[];
}
export function contentText(entry: Partial<Content>) {
  const walk = (nodes: any[]): string =>
    nodes
      .map((n) => {
        const text = [
          "core/paragraph",
          "core/heading",
          "core/rich-text",
          "core/html",
        ].includes(n.type)
          ? String(n.settings?.html || n.settings?.text || "")
          : "";
        return text + " " + walk(n.children || []);
      })
      .join(" ");
  return (
    Array.isArray(entry.details?.contentBlocks)
      ? walk(entry.details.contentBlocks)
      : entry.body || ""
  )
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
/** Editorial guidance only: deterministic checks shared by the Inspector and tables. */
export function analyzeSeo(
  entry: Partial<Content>,
  titleSettings?: TitleSettings,
) {
  const options = entry.details?.seo || {};
  const baseTitle = entry.details?.metaTitle || entry.title || "";
  const title = titleSettings
    ? formatPageTitle(baseTitle, titleSettings)
    : baseTitle;
  const description = entry.details?.metaDescription || entry.excerpt || "";
  const text = contentText(entry);
  const keyword = (options.focusKeyword || "").trim().toLowerCase();
  const contains = (value: string) =>
    !!keyword && value.toLowerCase().includes(keyword);
  const checks = [
    {
      label: "Title is between 30 and 60 characters",
      pass: title.length >= 30 && title.length <= 60,
    },
    {
      label: "Description is between 120 and 160 characters",
      pass: description.length >= 120 && description.length <= 160,
    },
    { label: "Focus keyword is set", pass: !!keyword },
    { label: "Focus keyword appears in the title", pass: contains(title) },
    {
      label: "Focus keyword appears in the description",
      pass: contains(description),
    },
    {
      label: "Focus keyword appears in the URL",
      pass: contains((entry.slug || "").replaceAll("-", " ")),
    },
    {
      label: "Focus keyword appears near the start of the content",
      pass: contains(text.slice(0, 600)),
    },
    {
      label: "Content has at least 150 words",
      pass: text.split(/\s+/).filter(Boolean).length >= 150,
    },
    { label: "Featured image is set", pass: !!entry.details?.featuredImageId },
    { label: "Page allows indexing", pass: !options.noindex },
  ];
  const score = checks.filter((c) => c.pass).length * 10;
  return {
    score,
    checks,
    words: text.split(/\s+/).filter(Boolean).length,
    level: score >= 80 ? "good" : score >= 50 ? "fair" : "poor",
  };
}
