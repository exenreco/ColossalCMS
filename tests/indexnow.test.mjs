import test from "node:test";
import assert from "node:assert/strict";
import { localDatabase } from "../scripts/local-database.mjs";
import worker, { initialize } from "../server/worker.mjs";
import {
  seoDefaults,
  validateSeoSettings,
  submitIndexNow,
  indexNowKeyFile,
} from "../server/seo.mjs";
const key = "0123456789abcdef0123456789abcdef";
const request = new Request("https://example.test/api/admin/seo/index");
async function database() {
  const db = localDatabase();
  await initialize(db, { email: "owner@example.test" });
  await db
    .prepare("INSERT INTO config(id,value) VALUES('seo',?)")
    .bind(
      JSON.stringify({
        ...seoDefaults,
        siteUrl: "https://example.test",
        indexNowEnabled: true,
        indexNowKey: key,
      }),
    )
    .run();
  return db;
}
test("IndexNow sends only the stored published URL and reports pending verification accurately", async () => {
  const db = await database();
  try {
    let body;
    const result = await submitIndexNow(
      db,
      request,
      "about",
      async (endpoint, options) => {
        assert.equal(endpoint, "https://api.indexnow.org/indexnow");
        body = JSON.parse(options.body);
        return new Response(null, { status: 202 });
      },
    );
    assert.deepEqual(body, {
      host: "example.test",
      key,
      keyLocation: `https://example.test/${key}.txt`,
      urlList: ["https://example.test/about"],
    });
    assert.equal(result.submitted, true);
    assert.match(result.message, /verification is pending/);
    assert.match(result.message, /not guaranteed/);
    assert.equal(await (await indexNowKeyFile(db, `/${key}.txt`)).text(), key);
    assert.equal(await indexNowKeyFile(db, "/different-key.txt"), null);
  } finally {
    db.close();
  }
});
test("IndexNow excludes private, noindex, foreign canonical and non-production submissions", async () => {
  const db = await database();
  const send = () => assert.fail("Provider must not be contacted");
  try {
    await assert.rejects(
      submitIndexNow(db, request, "next-chapter", send),
      /published, indexable/,
    );
    await assert.rejects(
      submitIndexNow(
        db,
        new Request("http://localhost:4200/api/admin/seo/index"),
        "about",
        send,
      ),
      /configured production/,
    );
    await db
      .prepare("UPDATE content SET details=? WHERE id='about'")
      .bind(JSON.stringify({ seo: { noindex: true } }))
      .run();
    await assert.rejects(
      submitIndexNow(db, request, "about", send),
      /published, indexable/,
    );
    await db
      .prepare("UPDATE content SET details=? WHERE id='about'")
      .bind(JSON.stringify({ seo: { canonical: "https://other.test/about" } }))
      .run();
    await assert.rejects(
      submitIndexNow(db, request, "about", send),
      /another site/,
    );
    await db
      .prepare("UPDATE plugins SET active=0 WHERE id='com.colossal.seo'")
      .run();
    assert.equal(await indexNowKeyFile(db, `/${key}.txt`), null);
    await assert.rejects(
      submitIndexNow(db, request, "welcome", send),
      /Activate Advanced SEO/,
    );
  } finally {
    db.close();
  }
});
test("provider failures are actionable and never expose raw errors", async () => {
  const db = await database();
  try {
    await assert.rejects(
      submitIndexNow(
        db,
        request,
        "about",
        async () =>
          new Response("sensitive raw provider response", { status: 403 }),
      ),
      /could not verify the key/,
    );
    await assert.rejects(
      submitIndexNow(
        db,
        request,
        "about",
        async () => new Response(null, { status: 429 }),
      ),
      (error) => error.status === 429,
    );
    await assert.rejects(
      submitIndexNow(db, request, "about", async () => {
        throw new Error("secret raw network details");
      }),
      (error) => error.status === 502 && !error.message.includes("secret"),
    );
  } finally {
    db.close();
  }
});
test("IndexNow validates configuration and requires member identity and same-origin mutations", async () => {
  assert.throws(
    () => validateSeoSettings({ ...seoDefaults, indexNowEnabled: true }),
    /production site/,
  );
  assert.throws(
    () => validateSeoSettings({ ...seoDefaults, indexNowKey: "bad/key" }),
    /letters, numbers/,
  );
  const DB = await database();
  const env = {
    DB,
    ASSETS: { fetch: async () => new Response("not found", { status: 404 }) },
  };
  try {
    const response = await worker.fetch(
      new Request("https://example.test/api/admin/seo/index", {
        method: "POST",
        headers: {
          Origin: "https://example.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contentId: "about" }),
      }),
      env,
    );
    assert.equal(response.status, 401);
    const file = await worker.fetch(
      new Request(`https://example.test/${key}.txt`),
      env,
    );
    assert.equal(file.status, 200);
    assert.equal(await file.text(), key);
    const head = await worker.fetch(
      new Request(`https://example.test/${key}.txt`, { method: "HEAD" }),
      env,
    );
    assert.equal(await head.text(), "");
  } finally {
    DB.close();
  }
});
