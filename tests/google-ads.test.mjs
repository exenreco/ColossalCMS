import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../server/worker.mjs";
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
