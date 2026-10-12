import test from "node:test";
import assert from "node:assert/strict";
import worker from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { analyzeSeo } from "../shared/seo.ts";
import {
  seoDefaults,
  validateSeo,
  validateSeoSettings,
  seoMetadata,
  seoHead,
} from "../server/seo.mjs";
import { publicHtml } from "../server/public-html.mjs";
import { validateDetails } from "../server/v2-utils.mjs";

test("SEO scores inspect native block text and return actionable checks without saved stale scores", () => {
  const entry = {
    kind: "page",
    title: "A complete guide to thoughtful design",
    slug: "thoughtful-design",
    excerpt:
      "Thoughtful design helps people find clarity. Learn practical methods for planning, creating, and refining useful websites with this detailed guide.",
    body: "Ignored stale body",
    details: {
      featuredImageId: "image",
      seo: { focusKeyword: "thoughtful design" },
      contentBlocks: [
        {
          type: "core/container",
          children: [
            {
              type: "core/paragraph",
              settings: {
                html: "<p>Thoughtful design " + "word ".repeat(160) + "</p>",
              },
            },
          ],
        },
      ],
    },
  };
  assert.equal(analyzeSeo(entry).score, 100);
  entry.details.seo.noindex = true;
  assert.equal(analyzeSeo(entry).score, 90);
  entry.details.contentBlocks = [];
  assert.equal(analyzeSeo(entry).words, 0);
});
test("SEO validation rejects unsafe URLs and malformed schema and preserves valid options", async () => {
  for (const canonical of [
    "javascript:alert(1)",
    "//evil.test",
    "https://user:password@example.test",
    "not a url",
  ])
    assert.throws(() => validateSeo({ canonical }), /URLs/);
  assert.throws(() => validateSeo({ schemaType: "FakeSchema" }), /schema/);
  assert.throws(() => validateSeo({ noindex: "false" }), /indexing/);
  assert.throws(() => validateSeo({ pillarContent: "true" }), /indexing/);
  assert.throws(
    () => validateSeo({ faq: [{ question: "Question", answer: "" }] }),
    /question and answer/,
  );
  assert.throws(
    () => validateSeoSettings({ ...seoDefaults, publisherType: "Invalid" }),
    /schema settings/,
  );
  const db = localDatabase();
  try {
    const validated = await validateDetails(db, {
      metaTitle: "My title",
      seo: {
        focusKeyword: "design",
        pillarContent: true,
        schemaType: "Article",
        authorName: "Public author",
        canonical: "https://example.test/my-page",
      },
    });
    assert.equal(validated.seo.authorName, "Public author");
    assert.equal(validated.seo.pillarContent, true);
    assert.equal(validateSeo({}).pillarContent, false);
    assert.equal(validated.seo.canonical, "https://example.test/my-page");
  } finally {
    db.close();
  }
});
test("schema uses public author names, safely embeds JSON-LD, and respects plugin and preview state", async () => {
  const db = localDatabase();
  const ctx = {
    path: "/article",
    kind: "post",
    plugins: [{ id: "com.colossal.seo" }],
    settings: { title: "Site", tagline: "Tagline" },
    content: {
      id: "story",
      kind: "post",
      title: "A story",
      author: "private@example.test",
      publishAt: "2026-01-01",
      details: {
        seo: {
          schemaType: "Article",
          authorName: "</script><script>alert(1)</script>",
          noindex: true,
          socialTitle: "Social title",
        },
      },
    },
  };
  try {
    const { seo } = await seoMetadata(db, ctx, "https://example.test");
    assert.equal(seo.canonical, "https://example.test/article");
    assert.equal(seo.robots, "noindex, follow");
    assert.equal(seo.socialTitle, "Social title");
    const head = seoHead(seo);
    assert.ok(!head.includes("private@example.test"));
    assert.ok(!head.includes("</script><script>"));
    const script = head.match(/<script[^>]*>(.*?)<\/script>/)[1];
    assert.equal(
      JSON.parse(script)["@graph"].find((n) => n["@type"] === "Article").author
        .name,
      ctx.content.details.seo.authorName,
    );
    assert.equal(
      (await seoMetadata(db, ctx, "https://example.test", true)).seo,
      undefined,
    );
    assert.equal(
      (await seoMetadata(db, { ...ctx, plugins: [] }, "https://example.test"))
        .seo,
      undefined,
    );
    ctx.content.details.seo = {
      schemaType: "FAQPage",
      faq: [{ question: "What is design?", answer: "A useful process." }],
    };
    const faq = (
      await seoMetadata(db, ctx, "https://example.test")
    ).seo.graph.find((n) => n["@type"] === "FAQPage");
    assert.equal(faq.mainEntity[0].acceptedAnswer.text, "A useful process.");
    const html = publicHtml(
      "<html><head><title>Old</title></head><body><cl-frontend></cl-frontend></body></html>",
      {
        html: "<main>Content</main>",
        css: "",
        seo,
        title: "Page",
        description: "Description",
      },
    );
    assert.match(html, /rel="canonical"/);
    assert.match(html, /application\/ld\+json/);
  } finally {
    db.close();
  }
});
test("SEO settings, persisted content, public metadata, sitemap filtering and deactivation work end to end", async () => {
  const DB = localDatabase();
  const env = {
    DB,
    ASSETS: {
      fetch: async () =>
        new Response(
          "<html><head><title>CMS</title></head><body><cl-frontend></cl-frontend></body></html>",
          { headers: { "Content-Type": "text/html" } },
        ),
    },
  };
  const owner = {
    "oai-authenticated-user-id": "owner",
    "oai-authenticated-user-email": "owner@example.test",
  };
  const call = (path, method = "GET", body, headers = owner) =>
    worker.fetch(
      new Request("https://cms.test" + path, {
        method,
        headers: {
          ...headers,
          Origin: "https://cms.test",
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
  try {
    assert.equal((await call("/api/admin/setup", "POST", {})).status, 200);
    assert.equal(
      (await call("/api/admin/seo", "GET", undefined, {})).status,
      401,
    );
    await DB.prepare(
      "INSERT INTO members(id,email,role) VALUES('editor','editor@example.test','editor')",
    ).run();
    assert.equal(
      (
        await call("/api/admin/seo", "POST", seoDefaults, {
          "oai-authenticated-user-id": "editor",
          "oai-authenticated-user-email": "editor@example.test",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/api/admin/seo", "POST", {
          ...seoDefaults,
          siteUrl: "https://example.test",
          publisherName: "Studio",
        })
      ).status,
      200,
    );
    assert.equal(
      (await (await call("/api/admin/seo")).json()).publisherName,
      "Studio",
    );
    const entry = (await (await call("/api/admin/state")).json()).content.find(
      (c) => c.id === "about",
    );
    const save = await call("/api/admin/content", "POST", {
      ...entry,
      details: {
        ...entry.details,
        seo: {
          noindex: true,
          focusKeyword: "work",
          schemaType: "AboutPage",
          socialTitle: "Social about",
        },
      },
    });
    assert.equal(save.status, 200, await save.text());
    const page = await call("/about", "GET", undefined, {});
    const html = await page.text();
    assert.equal(page.headers.get("X-Robots-Tag"), "noindex, follow");
    assert.match(html, /content="Social about"/);
    assert.match(html, /AboutPage/);
    const sitemap = await (
      await call("/sitemap.xml", "GET", undefined, {})
    ).text();
    assert.ok(!sitemap.includes("/about"));
    assert.ok(!sitemap.includes("next-chapter"));
    assert.ok(sitemap.includes("good-things-start"));
    const robots = await (
      await call("/robots.txt", "GET", undefined, {})
    ).text();
    assert.match(robots, /Sitemap: https:\/\/example.test\/sitemap.xml/);
    await DB.prepare(
      "UPDATE plugins SET active=0 WHERE id='com.colossal.seo'",
    ).run();
    const disabled = await (await call("/about", "GET", undefined, {})).text();
    assert.ok(!disabled.includes("data-cms-seo"));
  } finally {
    DB.close();
  }
});
