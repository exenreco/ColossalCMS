import test from "node:test";
import assert from "node:assert/strict";
import worker from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { MAINTENANCE_ID, maintenanceHtml } from "../server/maintenance.mjs";
import { references } from "../server/v2-utils.mjs";
import { CORE_THEME_ID } from "../server/theme-engine.mjs";
import { upgradeMidnight } from "../server/midnight-maintenance.mjs";

test("Midnight upgrades existing published layouts and drafts once while retaining message edits and block IDs", async () => {
  const { DB, call } = await fixture();
  try {
    await call("/api/maintenance");
    const data = JSON.parse(
      (
        await DB.prepare(
          "SELECT value FROM config WHERE id='maintenance'",
        ).first()
      ).value,
    );
    const midnight = data.layouts.find((layout) => layout.name === "Midnight");
    const doc = midnight.published;
    doc.css = doc.css.split("/* Midnight geometry v1 */")[0];
    doc.templates.home.children.shift();
    const header = doc.templates.home.children.pop();
    const oldIdentity = header.children[0].children[0].children[0];
    oldIdentity.settings = { display: "name", level: "span", linkHome: false };
    doc.templates.home.children[0].children[0].children.unshift(oldIdentity);
    doc.blocks = doc.blocks.filter(
      (block) => block.type !== "maintenance/geometry",
    );
    doc.manifest.blocks = doc.manifest.blocks.filter(
      (block) => block.type !== "maintenance/geometry",
    );
    const heading = doc.templates.home.children[0].children.find(
      (block) => block.type === "core/heading",
    );
    heading.settings.text = "Our edited announcement";
    const id = heading.id;
    midnight.draft = structuredClone(doc);
    await DB.prepare("UPDATE config SET value=? WHERE id='maintenance'")
      .bind(JSON.stringify(data))
      .run();
    const record = (await call("/api/maintenance/" + midnight.id)).data;
    for (const document of [record.published, record.draft]) {
      assert.equal(
        document.templates.home.children[0].type,
        "maintenance/geometry",
      );
      assert.ok(JSON.stringify(document).includes(id));
      assert.ok(JSON.stringify(document).includes("Our edited announcement"));
      const header = document.templates.home.children.find(
        (block) => block.settings.classes === "midnight-header",
      );
      assert.equal(header.children[1].settings.href, "/login");
      assert.equal(header.settings.position, "fixed");
      assert.equal(header.settings.zIndex, 4);
      assert.equal(header.children[1].settings.iconName, "login");
      assert.equal(header.children[0].type, "core/columns");
      assert.equal(
        header.children[0].children[0].children[0].id,
        oldIdentity.id,
      );
      assert.equal(
        header.children[0].children[0].children[0].settings.display,
        "logo",
      );
      assert.equal(
        header.children[0].children[1].children[1].children[0].type,
        "core/tagline",
      );
      assert.doesNotMatch(document.css, /linear-gradient\(45deg/);
      const ids = [];
      const collect = (node) => {
        ids.push(node.id);
        node.children?.forEach(collect);
      };
      collect(document.templates.home);
      assert.equal(new Set(ids).size, ids.length);
      assert.equal(upgradeMidnight(document), false);
    }
    const first = (
      await DB.prepare(
        "SELECT value FROM config WHERE id='maintenance'",
      ).first()
    ).value;
    await call("/api/maintenance");
    assert.equal(
      (
        await DB.prepare(
          "SELECT value FROM config WHERE id='maintenance'",
        ).first()
      ).value,
      first,
    );
    const rendered = (
      await call("/api/maintenance/" + midnight.id + "/render", "POST", {
        document: record.published,
        templateId: "home",
      })
    ).data;
    assert.match(rendered.html, /data-geometry-count="72"/);
    assert.match(rendered.html, /theme-site-brand/);
    assert.match(rendered.html, /href="\/login"/);
    assert.match(rendered.html, /<path d="M15 3h6v18h-6M3 12h12M10 7l5 5-5 5"/);
    assert.match(rendered.css, /rgba\(3,14,48,.88\)/);
    assert.doesNotMatch(rendered.html, /<script|<iframe/);
  } finally {
    DB.close();
  }
});

test("Midnight corrects v3 saved headers and normalized diagonal backgrounds in published layouts and drafts", async () => {
  const { DB, call } = await fixture();
  try {
    await call("/api/maintenance");
    const data = JSON.parse(
      (
        await DB.prepare(
          "SELECT value FROM config WHERE id='maintenance'",
        ).first()
      ).value,
    );
    const layout = data.layouts.find((item) => item.name === "Midnight");
    const doc = layout.published;
    doc.css = doc.css.split("/* Midnight header layout v4 */")[0];
    doc.css +=
      "\n.theme-root .maintenance-geometry { background-image: radial-gradient(circle, transparent, #000), linear-gradient(45deg, transparent 49%, #abcdef 50%, transparent 51%); background-size: 100px 100px, 220px 220px; }";
    const header = doc.templates.home.children.find(
      (node) => node.settings.classes === "midnight-header",
    );
    header.children.reverse();
    const ids = header.children.map((node) => node.id).sort();
    layout.draft = structuredClone(doc);
    await DB.prepare("UPDATE config SET value=? WHERE id='maintenance'")
      .bind(JSON.stringify(data))
      .run();
    const result = (await call("/api/maintenance/" + layout.id)).data;
    for (const document of [result.published, result.draft]) {
      const migrated = document.templates.home.children.find(
        (node) => node.settings.classes === "midnight-header",
      );
      assert.equal(migrated.children[0].settings.classes, "midnight-brand");
      assert.equal(migrated.children.at(-1).settings.classes, "midnight-login");
      assert.deepEqual(migrated.children.map((node) => node.id).sort(), ids);
      assert.doesNotMatch(document.css, /linear-gradient\(45deg/);
      assert.match(document.css, /margin-left:0;margin-right:auto/);
      assert.equal(upgradeMidnight(document), false);
    }
  } finally {
    DB.close();
  }
});

async function fixture() {
  const DB = localDatabase();
  const owner = {
    "oai-authenticated-user-id": "owner",
    "oai-authenticated-user-email": "owner@example.test",
  };
  const env = {
    DB,
    ASSETS: {
      fetch: async () =>
        new Response(
          '<!doctype html><html><head><title>Normal site</title></head><body><cl-frontend></cl-frontend><script type="module" src="/main.js"></script></body></html>',
          { headers: { "Content-Type": "text/html", ETag: "static" } },
        ),
    },
    STORAGE: { get: async () => new Response(new Uint8Array([1, 2, 3])) },
  };
  const call = async (path, method = "GET", body, headers = owner) => {
    const response = await worker.fetch(
      new Request("https://cms.test" + path, {
        method,
        headers: {
          Origin: "https://cms.test",
          "Content-Type": "application/json",
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    return { response, status: response.status, text, data };
  };
  assert.equal((await call("/api/admin/setup", "POST", {})).status, 200);
  assert.equal(
    (
      await call("/api/admin/plugins", "POST", {
        id: MAINTENANCE_ID,
        action: "install",
      })
    ).status,
    200,
  );
  return { DB, call, owner };
}
const enable = async (call, enabled = true, extra = {}) => {
  const current = (await call("/api/maintenance")).data;
  return call("/api/maintenance/settings", "POST", {
    ...current.settings,
    ...extra,
    enabled,
    revision: current.revision,
  });
};

test("maintenance startup payload preserves markup and cannot close its JSON script", () => {
  const rendered = {
    html: "<h1>Maintenance</h1><p>&lt;sample&gt;</p>",
    css: "/* </style><script>bad()</script> */",
    title: "</script><script>bad()</script>",
    body: { className: "maintenance-body", style: "" },
    preview: true,
    maintenancePreview: true,
  };
  const html = maintenanceHtml(
    "<html><head><title>Site</title></head><body><cl-frontend></cl-frontend></body></html>",
    rendered,
  );
  const payload = html.match(
    /<script type="application\/json" id="maintenance-render">([\s\S]*?)<\/script>/,
  )[1];
  assert.doesNotMatch(payload, /</);
  assert.deepEqual(JSON.parse(payload), { ...rendered, maintenance: true });
  assert.ok(html.includes("<cl-frontend>" + rendered.html + "</cl-frontend>"));
  assert.doesNotMatch(html, /<script>bad\(\)<\/script>/);
});

test("maintenance seeds three independent layouts, stays off and protects management", async () => {
  const { DB, call } = await fixture();
  try {
    const data = (await call("/api/maintenance")).data;
    assert.deepEqual(
      data.layouts.map((l) => l.name),
      ["Quiet", "Midnight", "Studio"],
    );
    assert.equal(data.settings.enabled, false);
    assert.equal((await call("/", "GET", undefined, {})).status, 200);
    assert.equal((await call("/api/maintenance")).data.layouts.length, 3);
    assert.equal((await call("/api/themes")).data.length, 2);
    assert.equal(
      (await call("/admin/maintenance/edit/" + data.settings.layoutId)).status,
      200,
    );
    assert.equal(
      (await call("/api/maintenance", "GET", undefined, {})).status,
      401,
    );
    await call("/api/admin/members", "POST", {
      email: "editor@example.test",
      role: "editor",
    });
    assert.equal(
      (
        await call("/api/maintenance", "GET", undefined, {
          "oai-authenticated-user-id": "editor",
          "oai-authenticated-user-email": "editor@example.test",
        })
      ).status,
      403,
    );
    assert.equal(
      (await call("/api/maintenance/install", "POST", {})).status,
      404,
    );
    assert.equal(
      (
        await call(
          "/api/maintenance",
          "POST",
          { name: "New layout" },
          {
            "oai-authenticated-user-id": "owner",
            "oai-authenticated-user-email": "owner@example.test",
            Origin: "https://evil.test",
          },
        )
      ).status,
      403,
    );
  } finally {
    DB.close();
  }
});

test("maintenance serves rendered HTTP 503, preserves admin access and disables without losing layouts", async () => {
  const { DB, call } = await fixture();
  try {
    assert.equal((await enable(call, true, { retryAfter: 600 })).status, 200);
    for (const path of ["/", "/about", "/not-a-real-page", "/index.html"]) {
      const r = await call(path, "GET", undefined, {});
      assert.equal(r.status, 503);
      assert.equal(r.response.headers.get("Retry-After"), "600");
      assert.equal(r.response.headers.get("Cache-Control"), "no-store");
      assert.equal(r.response.headers.get("X-Robots-Tag"), "noindex");
      assert.equal(r.response.headers.get("ETag"), null);
      assert.match(r.text, /We’ll be back shortly/);
      assert.doesNotMatch(r.text, /Good things start/);
    }
    assert.equal((await call("/", "HEAD", undefined, {})).text, "");
    assert.equal((await call("/", "GET")).status, 200);
    assert.equal((await call("/admin/", "GET")).status, 200);
    assert.equal((await call("/main.js", "GET", undefined, {})).status, 200);
    const rendered = (await call("/api/themes/render", "GET", undefined, {}))
      .data;
    assert.equal(rendered.maintenance, true);
    assert.equal(rendered.status, 503);
    assert.equal(rendered.adsEnabled, false);
    assert.equal(
      (await call("/api/themes/render")).data.maintenance,
      undefined,
    );
    assert.deepEqual(
      (await call("/api/public", "GET", undefined, {})).data.content,
      [],
    );
    assert.ok((await call("/api/public")).data.content.length > 0);
    assert.equal(
      (await call("/?themePreview=forged", "GET", undefined, {})).status,
      401,
    );
    const preview = await call(
      "/api/themes/" + CORE_THEME_ID + "/preview",
      "POST",
      {},
    );
    assert.equal(
      (await call(preview.data.url, "GET", undefined, {})).status,
      200,
    );
    await call("/", "GET", undefined, { "Sec-Purpose": "prefetch" });
    const selectedPreview = (await call("/api/maintenance")).data.settings
      .layoutId;
    await call("/api/maintenance/" + selectedPreview + "/preview");
    const analytics = await call("/api/admin/analytics/views?type=maintenance");
    const selected = (await call("/api/maintenance")).data.settings.layoutId;
    assert.equal(analytics.status, 200);
    assert.equal(analytics.data.counts[selected], 4);
    assert.equal(analytics.data.days, 30);
    assert.equal(
      (
        await call(
          "/api/admin/analytics/views?type=maintenance",
          "GET",
          undefined,
          {},
        )
      ).status,
      401,
    );
    assert.equal(
      (await call("/api/admin/analytics/views?type=bad%20type")).status,
      400,
    );
    assert.equal(
      (await DB.prepare("SELECT COUNT(*) AS n FROM analytics_views").first()).n,
      4,
    );
    const originalPrepare = DB.prepare;
    DB.prepare = (sql) => {
      if (sql.startsWith("INSERT INTO analytics_views"))
        throw new Error("Tracking unavailable");
      return originalPrepare(sql);
    };
    assert.equal((await call("/about", "GET", undefined, {})).status, 503);
    DB.prepare = originalPrepare;
    await call("/api/admin/plugins", "POST", {
      id: MAINTENANCE_ID,
      action: "deactivate",
    });
    assert.equal((await call("/", "GET", undefined, {})).status, 200);
    assert.equal((await call("/api/maintenance")).status, 409);
    await call("/api/admin/plugins", "POST", {
      id: MAINTENANCE_ID,
      action: "activate",
    });
    assert.equal((await call("/api/maintenance")).data.layouts.length, 3);
    await enable(call, false);
    assert.equal((await call("/", "GET", undefined, {})).status, 200);
  } finally {
    DB.close();
  }
});

test("maintenance drafts, templates, publishing, history, clones and conflicts are independent of site themes", async () => {
  const { DB, call } = await fixture();
  try {
    const initial = (await call("/api/maintenance")).data,
      id = initial.settings.layoutId;
    const before = (await call("/api/themes/" + CORE_THEME_ID)).data;
    const record = (await call("/api/maintenance/" + id)).data;
    const d = structuredClone(record.published);
    d.templates.home.children[0].children.find(
      (b) => b.type === "core/heading",
    ).settings.text = "Draft is private";
    d.templates.custom = {
      id: "blk_" + crypto.randomUUID(),
      type: "core/container",
      settings: {},
      children: [
        {
          id: "blk_" + crypto.randomUUID(),
          type: "core/heading",
          settings: { text: "Custom maintenance template", level: "h1" },
        },
      ],
    };
    d.manifest.templates.push({
      id: "custom",
      name: "Custom",
      file: "templates/custom.html",
      appliesTo: ["home"],
    });
    const draft = await call("/api/maintenance/" + id + "/draft", "PUT", {
      document: d,
      revision: record.revision,
    });
    assert.equal(draft.status, 200, draft.text);
    assert.equal(
      (
        await call("/api/maintenance/" + id + "/draft", "PUT", {
          document: d,
          revision: record.revision,
        })
      ).status,
      409,
    );
    await enable(call);
    assert.doesNotMatch(
      (await call("/", "GET", undefined, {})).text,
      /Draft is private/,
    );
    const preview = await call("/api/maintenance/" + id + "/preview");
    assert.equal(preview.status, 200);
    assert.match(preview.text, /Draft is private|colossal-maintenance-preview/);
    const customPreview = await call(
      "/api/maintenance/" + id + "/preview",
      "POST",
      {
        templateId: "custom",
      },
    );
    assert.match(customPreview.data.url, /templateId=custom/);
    assert.match(
      (await call(customPreview.data.url)).text,
      /Custom maintenance template/,
    );
    assert.match(
      (
        await call(
          "/api/maintenance/" + id + "/preview-render?templateId=custom",
        )
      ).data.html,
      /Custom maintenance template/,
    );
    assert.equal(
      (await call("/api/maintenance/" + id + "/preview", "GET", undefined, {}))
        .status,
      401,
    );
    assert.equal(
      (await call("/api/maintenance/" + id + "/preview-render")).data
        .maintenancePreview,
      true,
    );
    assert.equal(
      (
        await call("/api/maintenance/" + id + "/publish", "POST", {
          revision: draft.data.revision,
        })
      ).status,
      200,
    );
    assert.match(
      (await call("/", "GET", undefined, {})).text,
      /Draft is private/,
    );
    const published = (await call("/api/maintenance/" + id)).data;
    assert.equal(published.history.length, 1);
    await enable(call, true, { templateId: "custom" });
    assert.match(
      (await call("/", "GET", undefined, {})).text,
      /Custom maintenance template/,
    );
    assert.equal(
      (
        await call("/api/maintenance/" + id + "/restore", "POST", {
          historyId: published.history[0].id,
          revision: published.revision,
        })
      ).status,
      200,
    );
    const restored = (await call("/api/maintenance/" + id)).data;
    assert.equal(restored.hasDraft, true);
    assert.equal(
      (
        await call("/api/maintenance/" + id + "/revert", "POST", {
          revision: restored.revision,
        })
      ).status,
      200,
    );
    const latest = (await call("/api/maintenance/" + id)).data;
    const clone = await call("/api/maintenance/" + id + "/clone", "POST", {
      name: "Copy",
      revision: latest.revision,
    });
    assert.equal(clone.status, 200);
    assert.equal(
      (await call("/api/maintenance/" + clone.data.id, "DELETE")).status,
      200,
    );
    assert.equal((await call("/api/maintenance/" + id, "DELETE")).status, 409);
    const created = await call("/api/maintenance", "POST", { name: "Blank" });
    assert.equal(created.status, 201);
    assert.equal(
      (await call("/api/maintenance/" + created.data.id)).data.published
        .templates.home.children.length,
      0,
    );
    assert.deepEqual(
      (await call("/api/themes/" + CORE_THEME_ID)).data.published,
      before.published,
    );
    assert.equal(
      (
        await call("/api/maintenance/settings", "POST", {
          ...initial.settings,
          enabled: true,
          revision: initial.revision,
        })
      ).status,
      409,
    );
  } finally {
    DB.close();
  }
});

test("maintenance media references protect drafts/history and make selected published assets available", async () => {
  const { DB, call } = await fixture();
  try {
    await DB.prepare(
      "INSERT INTO media (id,type,name,mime,storage_key,uploaded_by,uploaded_at,updated_at) VALUES ('maintenance-image','image','Image','image/png','test','owner','','')",
    ).run();
    const state = (await call("/api/maintenance")).data,
      id = state.settings.layoutId;
    const record = (await call("/api/maintenance/" + id)).data;
    const d = structuredClone(record.published);
    d.templates.home.children.push({
      id: "blk_" + crypto.randomUUID(),
      type: "core/image",
      settings: { mediaId: "maintenance-image" },
    });
    const saved = await call("/api/maintenance/" + id + "/draft", "PUT", {
      revision: record.revision,
      document: d,
    });
    assert.equal(saved.status, 200, saved.text);
    assert.ok(
      (await references(DB, "maintenance-image")).some(
        (r) => r.kind === "maintenance" && !r.published,
      ),
    );
    assert.equal(
      (await call("/api/media/maintenance-image", "DELETE")).status,
      409,
    );
    assert.equal(
      (await call("/api/media/maintenance-image/file", "GET", undefined, {}))
        .status,
      401,
    );
    await call("/api/maintenance/" + id + "/publish", "POST", {
      revision: saved.data.revision,
    });
    await enable(call);
    assert.equal(
      (await call("/api/media/maintenance-image/file", "GET", undefined, {}))
        .status,
      200,
    );
    await enable(call, false);
    assert.equal(
      (await call("/api/media/maintenance-image/file", "GET", undefined, {}))
        .status,
      401,
    );
    d.templates.home.children.pop();
    const current = (await call("/api/maintenance/" + id)).data;
    const next = await call("/api/maintenance/" + id + "/draft", "PUT", {
      revision: current.revision,
      document: d,
    });
    await call("/api/maintenance/" + id + "/publish", "POST", {
      revision: next.data.revision,
    });
    assert.ok(
      (await references(DB, "maintenance-image")).some(
        (r) => r.kind === "maintenance-history",
      ),
    );
  } finally {
    DB.close();
  }
});
