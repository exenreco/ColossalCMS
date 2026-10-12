import test from "node:test";
import assert from "node:assert/strict";
import { formatPageTitle } from "../shared/page-title.ts";
import worker from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { analyzeSeo } from "../shared/seo.ts";

test("shared title formatter handles layouts, separators and missing values", () => {
  assert.equal(formatPageTitle("About", { title: "Studio" }), "About · Studio");
  assert.equal(
    formatPageTitle("About", {
      title: "Studio",
      titleFormat: "site-page",
      titleSeparator: "|",
    }),
    "Studio | About",
  );
  assert.equal(
    formatPageTitle("About", {
      title: "Studio",
      titleFormat: "page-site",
      titleSeparator: "—",
    }),
    "About — Studio",
  );
  assert.equal(
    formatPageTitle("About", { title: "Studio", titleFormat: "page-only" }),
    "About",
  );
  assert.equal(
    formatPageTitle("About", { title: "Studio", titleFormat: "site-only" }),
    "Studio",
  );
  assert.equal(formatPageTitle("", { title: "Studio" }), "Studio");
  assert.equal(formatPageTitle("About", { title: "" }), "About");
  assert.equal(
    formatPageTitle("About", {
      title: "Studio",
      titleFormat: "invalid",
      titleSeparator: "<script>",
    }),
    "About · Studio",
  );
});

test("settings persist title layout and public titles/social metadata follow it with or without SEO", async () => {
  const DB = localDatabase();
  const env = {
    DB,
    ASSETS: {
      fetch: async () =>
        new Response(
          "<html><head><title>CMS</title></head><body><cl-frontend></cl-frontend></body></html>",
        ),
    },
  };
  const headers = {
    "oai-authenticated-user-id": "owner",
    "oai-authenticated-user-email": "owner@example.test",
    Origin: "https://cms.test",
    "Content-Type": "application/json",
  };
  const call = (path, method = "GET", body) =>
    worker.fetch(
      new Request("https://cms.test" + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
  try {
    await call("/api/admin/setup", "POST", {});
    assert.equal(
      (await call("/api/admin/settings", "POST", { titleFormat: "invalid" }))
        .status,
      400,
    );
    assert.equal(
      (
        await call("/api/admin/settings", "POST", {
          titleSeparator: "<script>",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/api/admin/settings", "POST", {
          title: "Studio",
          titleFormat: "site-page",
          titleSeparator: "|",
        })
      ).status,
      200,
    );
    const state = await (await call("/api/admin/state")).json();
    assert.equal(state.settings.titleFormat, "site-page");
    const about = state.content.find((entry) => entry.id === "about");
    await call("/api/admin/content", "POST", {
      ...about,
      details: { ...about.details, metaTitle: "Our work" },
    });
    let html = await (await call("/about")).text();
    assert.match(html, /<title>Studio \| Our work<\/title>/);
    assert.match(
      html,
      /<meta property="og:title" content="Studio \| Our work"/,
    );
    await DB.prepare(
      "UPDATE plugins SET active=0 WHERE id='com.colossal.seo'",
    ).run();
    html = await (await call("/about")).text();
    assert.match(html, /<title>Studio \| Our work<\/title>/);
    await call("/api/admin/settings", "POST", { titleFormat: "page-only" });
    html = await (await call("/about")).text();
    assert.match(html, /<title>Our work<\/title>/);
    const entry = {
      title: "A complete guide to thoughtful design",
      details: {},
    };
    assert.equal(
      analyzeSeo(entry, {
        title: "A very long publisher identity which adds to the final title",
      }).checks[0].pass,
      false,
    );
    assert.equal(
      analyzeSeo(entry, { title: "Studio", titleFormat: "page-only" }).checks[0]
        .pass,
      true,
    );
  } finally {
    DB.close();
  }
});
