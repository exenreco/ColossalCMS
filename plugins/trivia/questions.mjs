import sanitizeHtml from "sanitize-html";
import { parseDocument } from "htmlparser2";
import { textContent } from "domutils";
export const TRIVIA_ID = "com.colossal.trivia";
export const defaults = {
  enabled: true,
  scope: "all",
  questionCount: 5,
  excludedIds: [],
};
const stop = new Set(
  "about after again along already also another around based because before behind being between brings classroom could different does every first following from further gives have here into itself looking many more most much needed notes only other outside over page pages people place post posts project projects public recorded same should site some something space starting that their them then there these they this through together under using very what when where which while will with work would your worthwhile".split(
    " ",
  ),
);
const plain = (html) =>
  textContent(
    parseDocument(
      sanitizeHtml(
        String(html || "").replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?>/gi, " "),
        {
          allowedTags: [],
          allowedAttributes: {},
        },
      ),
    ),
  )
    .replace(/\s+/g, " ")
    .trim();
export function normalizeAnswer(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
export function contentText(content) {
  const chunks = [];
  const blocks = (nodes) => {
    for (const node of nodes || []) {
      if (
        [
          "core/paragraph",
          "core/heading",
          "core/rich-text",
          "core/html",
        ].includes(node.type)
      )
        chunks.push(plain(node.settings?.html || node.settings?.text || ""));
      blocks(node.children);
    }
  };
  const rich = (node) => {
    if (!node) return "";
    return (
      node.text ||
      (node.content || []).map(rich).join(node.type === "doc" ? "\n" : " ")
    );
  };
  if (Array.isArray(content.details?.contentBlocks))
    blocks(content.details.contentBlocks);
  else if (content.details?.richText)
    chunks.push(rich(content.details.richText));
  else chunks.push(plain(content.body));
  if (!chunks.some((chunk) => chunk.trim()))
    chunks.push(plain(content.excerpt));
  return chunks.join("\n").slice(0, 50000);
}
export function validateSettings(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    !["all", "pages", "posts"].includes(input.scope) ||
    !Number.isInteger(input.questionCount) ||
    input.questionCount < 1 ||
    input.questionCount > 20 ||
    !Array.isArray(input.excludedIds) ||
    input.excludedIds.length > 200 ||
    input.excludedIds.some((id) => typeof id !== "string" || id.length > 150)
  )
    throw Object.assign(
      new Error("Check trivia sources and question count (1–20)."),
      { status: 400 },
    );
  return {
    enabled: input.enabled === true,
    scope: input.scope,
    questionCount: input.questionCount,
    excludedIds: [...new Set(input.excludedIds)],
  };
}
const digest = async (value) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
export async function generateQuestions(
  content,
  settings = defaults,
  now = new Date(),
) {
  const bank = [];
  for (const item of content.slice(0, 200)) {
    if (
      !["page", "post"].includes(item.kind) ||
      !(
        item.status === "published" ||
        (item.status === "scheduled" &&
          new Date(item.publishAt || item.publish_at).getTime() <=
            now.getTime())
      ) ||
      settings.excludedIds?.includes(item.id) ||
      (settings.scope === "pages" && item.kind !== "page") ||
      (settings.scope === "posts" && item.kind !== "post")
    )
      continue;
    const text = contentText(item);
    const sentences = text
      .split(/(?<=[.!?])\s+|\n+/)
      .filter((s) => s.length >= 45 && s.length <= 260)
      .slice(0, 40);
    let perSource = 0;
    for (const sentence of sentences) {
      const words = [...sentence.matchAll(/\b[A-Za-z][A-Za-z'-]{4,24}\b/g)]
        .filter(
          (m) =>
            !stop.has(m[0].toLowerCase()) &&
            sentence.toLowerCase().split(m[0].toLowerCase()).length === 2,
        )
        .sort((a, b) => b[0].length - a[0].length);
      const chosen = words[0];
      if (!chosen) continue;
      const answer = chosen[0];
      const id = await digest(JSON.stringify([item.id, sentence, answer]));
      const date = new Date(item.publishAt || item.publish_at);
      const url =
        item.kind === "page"
          ? "/" + item.slug
          : "/" +
            date.getUTCFullYear() +
            "/" +
            String(date.getUTCMonth() + 1).padStart(2, "0") +
            "/" +
            item.slug;
      bank.push({
        id,
        prompt:
          sentence.slice(0, chosen.index) +
          "_____" +
          sentence.slice(chosen.index + answer.length),
        answer,
        explanation: sentence,
        source: { id: item.id, title: item.title, url },
      });
      if (++perSource >= 8 || bank.length >= 500) break;
    }
    if (bank.length >= 500) break;
  }
  return bank;
}
export function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const value = crypto.getRandomValues(new Uint32Array(1))[0];
    const j = value % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function publicQuestions(bank, count) {
  const pool = [
    ...new Map(bank.map((q) => [normalizeAnswer(q.answer), q.answer])).values(),
  ];
  return shuffled(bank)
    .slice(0, count)
    .map((q) => {
      const different = shuffled(pool).filter(
        (word) => normalizeAnswer(word) !== normalizeAnswer(q.answer),
      );
      for (const word of ["creativity", "technology", "discovery", "community"])
        if (
          !different.some((value) => normalizeAnswer(value) === word) &&
          normalizeAnswer(q.answer) !== word
        )
          different.push(word);
      return {
        id: q.id,
        prompt: q.prompt,
        source: q.source,
        options: shuffled([q.answer, ...different.slice(0, 3)]),
      };
    });
}
