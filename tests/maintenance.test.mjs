import test from "node:test";
import assert from "node:assert/strict";
import worker from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { MAINTENANCE_ID, maintenanceHtml } from "../server/maintenance.mjs";
import { references } from "../server/v2-utils.mjs";
import { CORE_THEME_ID } from "../server/theme-engine.mjs";

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
    assert.equal((await call("/api/themes")).data.length, 1);
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
