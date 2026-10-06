import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { initialize } from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import {
  adDefaults,
  validateAdSettings,
  resolveAdUnit,
  GOOGLE_ADS_ID,
} from "../server/google-ads.mjs";
import {
  defaultTheme,
  validateDocument,
  renderTheme,
  renderContentCanvas,
} from "../server/theme-engine.mjs";
import { validateDetails } from "../server/v2-utils.mjs";

const config = {
  ...adDefaults,
  publisherId: "ca-pub-1234567890123456",
  slotId: "1234567890",
  liveAds: true,
};
const ad = (settings = {}) => ({
  id: "blk_ads-test-0001",
  type: "google-ads/ad",
  settings,
});
const ctx = (extra = {}) => ({
  kind: "page",
  content: {
    id: "ads-page",
    title: "Ad page",
    details: { contentBlocks: [ad()] },
  },
  settings: { title: "Test", tagline: "" },
  plugins: [{ id: GOOGLE_ADS_ID }],
  adSettings: config,
  media: [],
  allContent: [],
  path: "/ads-page",
  ...extra,
});

test("AdSense verification is visible without JavaScript or live ads and follows plugin state", async () => {
  const DB = localDatabase();
  const env = {
    DB,
    ASSETS: {
      fetch: async () =>
        new Response("<html><head></head><body>CMS</body></html>", {
          headers: {
            "Content-Type": "text/html",
            "Content-Length": "49",
            ETag: "static",
          },
        }),
    },
  };
  const call = (path, method = "GET") =>
    worker.fetch(new Request("https://cms.test" + path, { method }), env);
  try {
    await initialize(DB, { email: "owner@example.test" });
    assert.equal((await call("/ads.txt")).status, 404);
    await DB.prepare("UPDATE plugins SET active=1,installed=1 WHERE id=?")
      .bind(GOOGLE_ADS_ID)
      .run();
    await DB.prepare("INSERT INTO config (id,value) VALUES ('google-ads',?)")
      .bind(JSON.stringify({ ...adDefaults, publisherId: config.publisherId }))
      .run();
    for (const path of ["/", "/index.html", "/about"]) {
      const html = await call(path);
      assert.match(
        await html.text(),
        /<meta name="google-adsense-account" content="ca-pub-1234567890123456"><\/head>/,
      );
      assert.equal(html.headers.get("Content-Length"), null);
      assert.equal(html.headers.get("ETag"), null);
    }
    const ads = await call("/ads.txt");
    assert.equal(ads.status, 200);
    assert.match(ads.headers.get("Content-Type"), /text\/plain/);
    assert.equal(
      await ads.text(),
      "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n",
    );
    assert.equal(await (await call("/ads.txt", "HEAD")).text(), "");
    const admin = await worker.fetch(
      new Request("https://cms.test/admin/", {
        headers: { "oai-authenticated-user-id": "owner" },
      }),
      env,
    );
    assert.doesNotMatch(await admin.text(), /google-adsense-account/);
    const custom =
      "# Advertising partners\ngoogle.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\nexample.com, seller-42, RESELLER";
    await DB.prepare("UPDATE config SET value=? WHERE id='google-ads'")
      .bind(
        JSON.stringify(
          validateAdSettings({
            ...config,
            verificationMeta: false,
            adsTxtContent: custom.replace(/\n/g, "\r\n"),
          }),
        ),
      )
      .run();
    assert.doesNotMatch(
      await (await call("/")).text(),
      /google-adsense-account/,
    );
    assert.equal(await (await call("/ads.txt")).text(), custom + "\n");
    await DB.prepare("UPDATE config SET value=? WHERE id='google-ads'")
      .bind(JSON.stringify({ ...config, adsTxtEnabled: false }))
      .run();
    assert.equal((await call("/ads.txt")).status, 404);
    assert.match(await (await call("/")).text(), /google-adsense-account/);
    await DB.prepare("UPDATE config SET value=? WHERE id='google-ads'")
      .bind(JSON.stringify({ publisherId: "<script>bad</script>" }))
      .run();
    assert.equal((await call("/ads.txt")).status, 404);
    assert.doesNotMatch(
      await (await call("/")).text(),
      /<script>|google-adsense-account/,
    );
    await DB.prepare("UPDATE config SET value=? WHERE id='google-ads'")
      .bind(JSON.stringify(config))
      .run();
    await DB.prepare("UPDATE plugins SET active=0 WHERE id=?")
      .bind(GOOGLE_ADS_ID)
      .run();
    assert.equal((await call("/ads.txt")).status, 404);
    assert.doesNotMatch(
      await (await call("/")).text(),
      /google-adsense-account/,
    );
  } finally {
    DB.close();
  }
});

test("AdSense settings validate identifiers, live-mode requirements, and inherited sizing", () => {
  assert.equal(
    validateAdSettings({ ...config, publisherId: "pub-1234567890123456" })
      .publisherId,
    config.publisherId,
  );
  for (const changed of [
    { publisherId: "<script>" },
    { slotId: '1" onclick=alert(1)' },
    { format: "anything" },
    { width: -1 },
    { height: 250.1 },
    { liveAds: "true" },
    { publisherId: "" },
    { verificationMeta: "true" },
    { adsTxtEnabled: 1 },
    { adsTxtContent: "<script>bad()</script>" },
    { adsTxtContent: "bad\u0000content" },
    { adsTxtContent: "x".repeat(20001) },
    { adsTxtContent: [] },
  ])
    assert.throws(() => validateAdSettings({ ...config, ...changed }));
  const fixed = resolveAdUnit(
    { ...config, sizing: "fixed", width: 728, height: 90 },
    { sizing: "default", width: 300, height: 250 },
  );
  assert.equal(fixed.width, 728);
  assert.equal(fixed.height, 90);
  assert.equal(
    resolveAdUnit(config, { slotId: "999", format: "rectangle" }).slotId,
    "999",
  );
  assert.equal(resolveAdUnit(config, { slotId: "javascript:alert(1)" }), null);
});

test("Ads render trusted data only on live pages and remain placeholders in every preview", () => {
  const document = defaultTheme();
  document.templates.default.children[1].children.push(ad());
  const validated = validateDocument(document, true);
  const live = renderTheme(validated, ctx());
  assert.match(live.html, /data-google-ad-client="ca-pub-1234567890123456"/);
  assert.match(live.html, /data-google-ad-slot="1234567890"/);
  assert.doesNotMatch(live.html, /<script|<ins/);
  for (const extra of [
    { adsPreview: true },
    { previewToken: "test" },
    { adSettings: { ...config, liveAds: false } },
  ]) {
    const preview = renderTheme(validated, ctx(extra));
    assert.match(preview.html, /cl-ad-preview/);
    assert.doesNotMatch(preview.html, /data-google-ad-client/);
  }
  const content = renderContentCanvas(validated, ctx(), "blk_ads-main-0001");
  assert.match(content.html, /cl-ad-preview/);
  assert.doesNotMatch(content.html, /data-google-ad-client/);
  assert.doesNotMatch(
    renderTheme(validated, ctx({ plugins: [] })).html,
    /cl-google-ad|data-google-ad-client/,
  );
  assert.doesNotMatch(
    renderTheme(validated, ctx({ adSettings: adDefaults })).html,
    /cl-google-ad|data-google-ad-client/,
  );
});

test("Google Ads settings are admin-only, persist separately, and Ads blocks round-trip in content", async () => {
  const DB = localDatabase();
  const env = {
    DB,
    STORAGE: {},
    ASSETS: { fetch: async () => new Response("asset") },
  };
  const owner = {
    "oai-authenticated-user-id": "ads-owner",
    "oai-authenticated-user-email": "ads@example.test",
  };
  const call = async (path, method = "GET", body, identity = owner) => {
    const response = await worker.fetch(
      new Request("https://cms.test/api" + path, {
        method,
        headers: {
          ...identity,
          Origin: "https://cms.test",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal((await call("/admin/setup", "POST", {})).status, 200);
    assert.equal(
      (await call("/admin/google-ads", "GET", undefined, {})).status,
      401,
    );
    await call("/admin/members", "POST", {
      email: "ads-editor@example.test",
      role: "editor",
    });
    const editor = {
      "oai-authenticated-user-id": "ads-editor",
      "oai-authenticated-user-email": "ads-editor@example.test",
    };
    assert.equal(
      (await call("/admin/google-ads", "GET", undefined, editor)).status,
      403,
    );
    assert.equal(
      (await call("/admin/google-ads", "POST", config, editor)).status,
      403,
    );
    assert.equal(
      (await call("/admin/google-ads", "POST", { ...config, slotId: "bad" }))
        .status,
      400,
    );
    assert.equal(
      (
        await call("/admin/plugins", "POST", {
          id: GOOGLE_ADS_ID,
          action: "install",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/admin/google-ads", "POST", {
          ...config,
          ignoredScript: "alert(1)",
        })
      ).status,
      200,
    );
    const saved = (await call("/admin/google-ads")).body;
    assert.deepEqual(saved, config);
    const details = await validateDetails(DB, {
      contentBlocks: [ad({ slotId: "9876543210" })],
    });
    assert.equal(details.contentBlocks[0].type, "google-ads/ad");
    const entry = {
      kind: "page",
      title: "Ads page",
      slug: "ads-page",
      status: "published",
      body: "",
      details,
    };
    assert.equal((await call("/admin/content", "POST", entry)).status, 200);
    const rendered = (await call("/themes/render?path=/ads-page")).body;
    assert.equal(rendered.adsEnabled, true);
    assert.match(rendered.html, /data-google-ad-slot="9876543210"/);
    await call("/admin/settings", "POST", {
      ...(await call("/admin/state")).body.settings,
      tagline: "Updated",
    });
    assert.deepEqual((await call("/admin/google-ads")).body, config);
    const verificationSettings = {
      ...config,
      verificationMeta: false,
      adsTxtEnabled: false,
      adsTxtContent: "# Custom partners",
    };
    assert.equal(
      (await call("/admin/google-ads", "POST", verificationSettings)).status,
      200,
    );
    assert.deepEqual(
      (await call("/admin/google-ads")).body,
      verificationSettings,
    );
    await call("/admin/plugins", "POST", {
      id: GOOGLE_ADS_ID,
      action: "deactivate",
    });
    const inactive = (await call("/themes/render?path=/ads-page")).body;
    assert.equal(inactive.adsEnabled, false);
    assert.doesNotMatch(inactive.html, /data-google-ad-client/);
  } finally {
    DB.close();
  }
});
