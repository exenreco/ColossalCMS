import { json, readJson, parse, all, fail } from "../../server/v2-utils.mjs";
import {
  TRIVIA_ID,
  defaults,
  validateSettings,
  generateQuestions,
  publicQuestions,
  normalizeAnswer,
} from "./questions.mjs";
export async function readTriviaSettings(db) {
  return {
    ...defaults,
    ...parse(
      (await db.prepare("SELECT value FROM config WHERE id='trivia'").first())
        ?.value,
    ),
  };
}
async function bankFor(db, query, admin = false) {
  const plugin = await db
    .prepare("SELECT installed,active FROM plugins WHERE id=?")
    .bind(TRIVIA_ID)
    .first();
  const settings = await readTriviaSettings(db);
  if (!admin && (!plugin?.installed || !plugin?.active || !settings.enabled))
    fail("Trivia is currently unavailable.", 404);
  const site = parse(
    (await db.prepare("SELECT value FROM config WHERE id='site'").first())
      ?.value,
  );
  const rows = await all(
    db,
    "SELECT id,kind,title,slug,body,excerpt,status,publish_at,details FROM content WHERE (status='published' OR status='scheduled') ORDER BY updated_at DESC LIMIT 200",
  );
  const requested = query.get("scope") || "default";
  if (!["default", "all", "pages", "posts", "current"].includes(requested))
    fail("Choose a valid trivia source.");
  const currentId = query.get("contentId");
  if (requested === "current" && !currentId)
    fail("Current-content trivia needs a page or post.");
  const scope =
    settings.scope === "all" && ["pages", "posts"].includes(requested)
      ? requested
      : settings.scope;
  const content = rows
    .filter(
      (row) =>
        row.id !== site.notFoundPageId &&
        (requested !== "current" || row.id === currentId),
    )
    .map((row) => ({
      ...row,
      details: parse(row.details),
      publishAt: row.publish_at,
    }));
  return {
    settings,
    content,
    bank: await generateQuestions(content, { ...settings, scope }),
  };
}
export default {
  id: TRIVIA_ID,
  routes: [
    {
      scope: "public",
      path: "/api/trivia/questions",
      methods: ["GET"],
      async handle({ request, database }) {
        const query = new URL(request.url).searchParams;
        const { settings, bank } = await bankFor(database(), query);
        const raw = query.get("count");
        const count = raw === null ? settings.questionCount : Number(raw);
        if (!Number.isInteger(count) || count < 1 || count > 20)
          fail("Choose 1–20 questions.");
        return json({
          questions: publicQuestions(bank, count),
          available: bank.length,
        });
      },
    },
    {
      scope: "public",
      path: "/api/trivia/answer",
      methods: ["POST"],
      async handle({ request, database }) {
        const body = await readJson(request, 4096);
        if (
          typeof body.id !== "string" ||
          body.id.length !== 64 ||
          typeof body.answer !== "string" ||
          !body.answer.trim() ||
          body.answer.length > 200
        )
          fail("Enter an answer to the trivia question.");
        const query = new URLSearchParams({
          scope: String(body.scope || "default"),
          contentId: String(body.contentId || ""),
        });
        const { bank } = await bankFor(database(), query);
        const question = bank.find((q) => q.id === body.id);
        if (!question)
          fail("This question is no longer available. Start a new round.", 409);
        return json({
          correct:
            normalizeAnswer(body.answer) === normalizeAnswer(question.answer),
          answer: question.answer,
          explanation: question.explanation,
          source: question.source,
        });
      },
    },
    {
      scope: "admin",
      path: "/api/admin/trivia",
      methods: ["GET", "POST"],
      admin: true,
      async handle({ request, db, log }) {
        if (request.method === "POST") {
          const settings = validateSettings(await readJson(request, 20000));
          await db
            .prepare(
              "INSERT INTO config (id,value) VALUES ('trivia',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
            )
            .bind(JSON.stringify(settings))
            .run();
          await log("Updated Trivia settings");
          return json({ ok: true });
        }
        const { settings, content, bank } = await bankFor(
          db,
          new URLSearchParams(),
          true,
        );
        return json({
          settings,
          available: bank.length,
          sources: content.map((c) => ({
            id: c.id,
            title: c.title,
            kind: c.kind,
          })),
          preview: publicQuestions(bank, 3),
        });
      },
    },
  ],
};
