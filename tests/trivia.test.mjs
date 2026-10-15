import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  generateQuestions,
  publicQuestions,
  normalizeAnswer,
  contentText,
} from "../plugins/trivia/questions.mjs";
import trivia from "../plugins/trivia/server.mjs";
import { createPluginRegistry } from "../server/plugin-registry.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import {
  renderTheme,
  defaultTheme,
  validateDocument,
} from "../server/theme-engine.mjs";

const statement =
  "The application organizes published articles into searchable collections for visitors.";
const content = (id, extra = {}) => ({
  id,
  kind: "page",
  title: "Our platform",
  slug: "platform",
  status: "published",
  body: statement,
  details: {},
  ...extra,
});
test("Trivia uses published content, supports native/rich HTML text and keeps correctness out of question payloads", async () => {
  const items = [
    content("public"),
    content("draft", {
      status: "draft",
      body: "Private credentials describe a confidential infrastructure for administrators.",
    }),
    content("future", { status: "scheduled", publishAt: "2999-01-01" }),
    content("excluded"),
  ];
  const bank = await generateQuestions(items, {
    ...defaults,
    excludedIds: ["excluded"],
  });
  assert.ok(bank.length);
  assert.ok(bank.every((q) => q.source.id === "public"));
  assert.match(bank[0].prompt, /_____/);
  assert.equal(normalizeAnswer("  CAFÉ! "), "cafe");
  const questions = publicQuestions(bank, 5);
  assert.ok(
    questions.every(
      (q) => !Object.hasOwn(q, "answer") && !Object.hasOwn(q, "explanation"),
    ),
  );
  assert.equal(new Set(questions[0].options).size, 4);
  assert.equal(
    contentText(
      content("native", {
        body: "Stale legacy body",
        details: {
          contentBlocks: [
            { type: "core/paragraph", settings: { html: statement } },
          ],
        },
      }),
    ),
    statement,
  );
  assert.doesNotMatch(
    contentText(
      content("html", { body: `<script>secret()</script><p>${statement}</p>` }),
    ),
    /secret/,
  );
  assert.equal(
    (
      await generateQuestions([content("page")], {
        ...defaults,
        scope: "posts",
      })
    ).length,
    0,
  );
});
test("Trivia routes enforce activation, validate answers, exclude 404 sources and invalidate changed or unpublished questions", async () => {
  const db = localDatabase();
  try {
    await db
      .prepare(
        "INSERT INTO plugins (id,active,installed) VALUES ('com.colossal.trivia',0,0)",
      )
      .run();
    await db
      .prepare("INSERT INTO config(id,value) VALUES ('site',?)")
      .bind(JSON.stringify({ notFoundPageId: "error-page" }))
      .run();
    for (const id of ["article", "error-page"])
      await db
        .prepare(
          "INSERT INTO content(id,kind,title,slug,body,excerpt,status,publish_at,updated_at,author,details) VALUES (?,?,?,?,?,'','published',?,?,?,'{}')",
        )
        .bind(
          id,
          "page",
          "Our platform",
          id,
          statement,
          "2026-01-01",
          "2026-01-01",
          "editor",
        )
        .run();
    const registry = createPluginRegistry([trivia]);
    const request = async (path, body) =>
      registry.dispatch("public", {
        path: path.split("?")[0],
        request: new Request(
          "https://cms.test" + path,
          body
            ? {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }
            : {},
        ),
        database: () => db,
      });
    await assert.rejects(request("/api/trivia/questions"), /unavailable/);
    await db.prepare("UPDATE plugins SET active=1,installed=1").run();
    const response = await request("/api/trivia/questions?count=3");
    const payload = await response.json();
    assert.ok(payload.questions.length);
    assert.ok(payload.questions.every((q) => q.source.id === "article"));
    const bank = await generateQuestions([
      content("article", { slug: "article" }),
    ]);
    const correct = await (
      await request("/api/trivia/answer", {
        id: bank[0].id,
        answer: bank[0].answer.toUpperCase(),
      })
    ).json();
    assert.equal(correct.correct, true);
    const incorrect = await (
      await request("/api/trivia/answer", { id: bank[0].id, answer: "wrong" })
    ).json();
    assert.equal(incorrect.correct, false);
    assert.equal(incorrect.answer, bank[0].answer);
    await assert.rejects(request("/api/trivia/questions?count=999"), /1–20/);
    await assert.rejects(
      request("/api/trivia/answer", { id: bank[0].id, answer: " " }),
      /Enter an answer/,
    );
    await db
      .prepare("UPDATE content SET status='draft' WHERE id='article'")
      .run();
    await assert.rejects(
      request("/api/trivia/answer", { id: bank[0].id, answer: bank[0].answer }),
      /no longer available/,
    );
    const adminRequest = new Request("https://cms.test/api/admin/trivia");
    await assert.rejects(
      registry.dispatch("admin", {
        path: "/api/admin/trivia",
        request: adminRequest,
        db,
        user: { role: "editor" },
      }),
      /Administrator/,
    );
  } finally {
    db.close();
  }
});
test("Trivia block is plugin-owned, editor-safe, configurable and hidden when inactive", () => {
  const d = defaultTheme();
  d.templates.default.children = [
    {
      id: "trivia-example",
      type: "trivia/quiz",
      settings: {
        title: "Site quiz",
        scope: "current",
        questionCount: 3,
        answerStyle: "text",
      },
    },
  ];
  const theme = validateDocument(d, true);
  const context = {
    kind: "page",
    content: { id: "page", title: "Page", details: {} },
    allContent: [],
    settings: {},
    media: [],
    plugins: [{ id: "com.colossal.trivia" }],
  };
  const rendered = renderTheme(theme, context, "default");
  assert.match(rendered.html, /data-trivia-style="text"/);
  assert.match(rendered.html, /data-trivia-scope="current"/);
  assert.match(rendered.html, /data-trivia-content="page"/);
  assert.match(rendered.css, /cl-trivia-options/);
  assert.doesNotMatch(rendered.html, /<script/);
  assert.doesNotMatch(
    renderTheme(theme, { ...context, plugins: [] }, "default").html,
    /class="cl-trivia"/,
  );
});
