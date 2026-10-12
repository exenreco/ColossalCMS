import { manifests } from "../plugins/registry.mjs";
export const catalog = manifests;
export const defaultSettings = {
  titleFormat: "page-site",
  titleSeparator: "·",
  title: "Colossal Journal",
  tagline: "A space for ideas worth sharing.",
  accent: "#246b50",
  logo: "",
  announcement: "Welcome to our corner of the internet.",
};
export const sampleContent = [
  {
    id: "welcome",
    kind: "post",
    title: "Good things start with a blank page",
    slug: "good-things-start",
    excerpt:
      "A new space for thoughtful ideas, useful discoveries, and the work in between.",
    body: "Every worthwhile project begins with a little curiosity. This journal is a place to follow that curiosity and share what we learn along the way.\n\nExpect considered ideas, practical notes, and an honest look at the process of building something meaningful.\n\nThis is sample content. Open Posts in your workspace to make this story your own.",
    status: "published",
  },
  {
    id: "about",
    kind: "page",
    title: "About us",
    slug: "about",
    excerpt: "A little about the people behind the work.",
    body: "We believe good work starts with clear thinking and a willingness to try.\n\nThis is your space to tell visitors who you are, what you do, and why it matters. Edit this sample page in your workspace.",
    status: "published",
  },
  {
    id: "next-chapter",
    kind: "post",
    title: "Notes on the next chapter",
    slug: "next-chapter",
    excerpt: "Some ideas need a little more room to grow.",
    body: "Start with the idea you cannot stop thinking about.\n\nThis sample draft is only visible in your workspace until you publish it.",
    status: "draft",
  },
].map((entry) => ({
  ...entry,
  details: {
    contentBlocks: entry.body.split(/\n\n+/).map((text, index) => ({
      id: `blk_sample_${entry.id}_${index + 1}`,
      type: "core/paragraph",
      settings: {
        html: text
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;"),
        align: "left",
      },
    })),
  },
}));

/** Upgrade untouched sample bodies without overwriting authored blocks or formatting. */
export async function migrateSampleContent(db) {
  for (const sample of sampleContent) {
    const row = await db
      .prepare("SELECT kind,body,details FROM content WHERE id=?")
      .bind(sample.id)
      .first();
    if (!row || row.kind !== sample.kind || row.body !== sample.body) continue;
    let details;
    try {
      details = JSON.parse(row.details || "{}");
    } catch {
      continue;
    }
    if (
      !details ||
      typeof details !== "object" ||
      Array.isArray(details) ||
      details.contentBlocks !== undefined ||
      details.richText !== undefined
    )
      continue;
    await db
      .prepare(
        "UPDATE content SET details=? WHERE id=? AND body=? AND details=?",
      )
      .bind(
        JSON.stringify({
          ...details,
          contentBlocks: sample.details.contentBlocks,
        }),
        sample.id,
        row.body,
        row.details,
      )
      .run();
  }
}
