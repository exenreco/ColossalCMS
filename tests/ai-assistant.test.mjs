import test from "node:test";
import assert from "node:assert/strict";
import { localDatabase } from "../scripts/local-database.mjs";
import worker from "../server/worker.mjs";
import { defaultTheme } from "../server/theme-engine.mjs";
import { editorBatch, editorRevision } from "../shared/editor-batch.ts";
import definitions from "../shared/theme-blocks.json" with { type: "json" };
import {
  providerText,
  providerModels,
  customEndpoint,
  defaults,
  validateSettings,
} from "../plugins/ai-assistant/providers.mjs";
import { validatePreview } from "../server/editor-automation.mjs";

const root = () => ({
  id: "root",
  type: "core/container",
  settings: {},
  children: [
    { id: "paragraph", type: "core/paragraph", settings: { html: "Before" } },
  ],
});
function streamResponse(events) {
  const text = events
    .map((data) => "data: " + JSON.stringify(data) + "\n\n")
    .join("");
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 7)
          controller.enqueue(bytes.slice(i, i + 7));
        controller.close();
      },
    }),
  );
}

test("editor batches preserve the original on failure and support inserted references", () => {
  const original = root(),
    before = JSON.stringify(original);
  assert.throws(() =>
    editorBatch(
      original,
      [
        { type: "update", id: "paragraph", settings: { html: "Changed" } },
        { type: "move", id: "root", parentId: "paragraph", index: 0 },
      ],
      definitions,
    ),
  );
  assert.equal(JSON.stringify(original), before);
  const result = editorBatch(
    original,
    [
      {
        type: "insert",
        blockType: "core/container",
        parentId: "root",
        index: 1,
        ref: "hero",
      },
      {
        type: "insert",
        blockType: "core/heading",
        parentId: "$hero",
        index: 0,
        settings: { text: "New heading", level: "h2" },
      },
    ],
    definitions,
  );
  assert.equal(
    result.root.children[1].children[0].settings.text,
    "New heading",
  );
  assert.notEqual(result.root.children[1].id, "root");
  assert.throws(
    () =>
      editorBatch(
        original,
        [{ type: "update", id: "paragraph", settings: { madeUpField: true } }],
        definitions,
      ),
    /Unsupported/,
  );
  assert.throws(
    () =>
      editorBatch(
        original,
        [
          {
            type: "insert",
            blockType: "core/slide",
            parentId: "root",
            index: 0,
          },
        ],
        definitions,
      ),
    /cannot be placed/,
  );
  assert.throws(
    () =>
      editorBatch(
        original,
        [
          {
            type: "insert",
            blockType: "core/pagination",
            parentId: "root",
            index: 0,
          },
        ],
        definitions,
      ),
    /Post list/,
  );
});

test("preview sanitizes HTML, protects revisions and does not persist drafts", async () => {
  const db = localDatabase();
  try {
    const document = defaultTheme();
    document.templates.home = root();
    const basis = { document, templateId: "home", part: "", kind: "Body" };
    const revision = await editorRevision(basis);
    const preview = await validatePreview(db, {
      ...basis,
      revision,
      commands: [
        {
          type: "update",
          id: "paragraph",
          settings: { html: "<b>After</b><script>alert(1)</script>" },
        },
      ],
    });
    assert.equal(preview.root.children[0].settings.html, "<b>After</b>");
    assert.equal(document.templates.home.children[0].settings.html, "Before");
    assert.equal(preview.changes.length, 1);
    assert.equal(preview.saved, false);
    assert.equal(
      (await db.prepare("SELECT id FROM themes").all()).results.length,
      0,
    );
    await assert.rejects(
      validatePreview(db, { ...basis, revision: "stale", commands: [] }),
      /revision/,
    );
    const main = await validatePreview(db, {
      ...basis,
      kind: "Main",
      revision: await editorRevision({ ...basis, kind: "Main" }),
      commands: [
        { type: "update", id: "paragraph", settings: { html: "Page text" } },
      ],
    });
    assert.equal(main.root.children[0].settings.html, "Page text");
  } finally {
    db.close();
  }
});

test("provider adapters use configured HTTPS endpoints and normalize chunked streams", async () => {
  for (const provider of ["openai", "anthropic", "gemini", "custom"]) {
    let request;
    const settings = {
      ...defaults,
      provider,
      customBaseUrl: "https://api.example.com/v1",
      models: { ...defaults.models, [provider]: "test-model" },
    };
    const events =
      provider === "openai"
        ? [{ type: "response.output_text.delta", delta: "Hello" }]
        : provider === "anthropic"
          ? [
              {
                type: "content_block_delta",
                delta: { type: "text_delta", text: "Hello" },
              },
            ]
          : provider === "custom"
            ? [
                {
                  choices: [
                    { delta: { content: "Hello" }, finish_reason: "stop" },
                  ],
                },
              ]
            : [{ candidates: [{ content: { parts: [{ text: "Hello" }] } }] }];
    let text = "";
    for await (const delta of providerText(
      settings,
      "private-key",
      "system",
      "prompt",
      new AbortController().signal,
      async (url, options) => {
        request = { url, options };
        return streamResponse(events);
      },
    ))
      text += delta;
    assert.equal(text, "Hello");
    assert.equal(request.options.redirect, "error");
    assert.equal(request.url.includes("private-key"), false);
    const body = JSON.parse(request.options.body);
    if (provider === "openai") assert.equal(body.store, false);
    if (provider === "custom") {
      assert.equal(request.url, "https://api.example.com/v1/chat/completions");
      assert.equal(body.messages[0].content, "system");
    }
  }
  assert.equal(
    validateSettings({ ...defaults, enabled: true, provider: "openai" }).models
      .openai,
    "",
  );
});

test("AI routes enforce activation, role, origin and credential secrecy", async () => {
  const DB = localDatabase(),
    owner = {
      "oai-authenticated-user-id": "owner",
      "oai-authenticated-user-email": "owner@example.test",
    };
  let calls = 0;
  const env = {
    DB,
    OPENAI_API_KEY: "private-key",
    AI_FETCH: async () => {
      calls++;
      return streamResponse([
        {
          type: "response.output_text.delta",
          delta: '{"message":"Suggested","commands":[]}',
        },
      ]);
    },
  };
  const call = (path, method = "GET", body, headers = owner) =>
    worker.fetch(
      new Request("https://cms.test/api/admin/ai-assistant" + path, {
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
  try {
    await worker.fetch(
      new Request("https://cms.test/api/admin/setup", {
        method: "POST",
        headers: {
          ...owner,
          Origin: "https://cms.test",
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
      env,
    );
    assert.equal((await call("/settings", "GET", undefined, {})).status, 401);
    await DB.prepare(
      "INSERT INTO members (id,email,role) VALUES ('reader','reader@example.test','reader')",
    ).run();
    assert.equal(
      (
        await call("/status", "GET", undefined, {
          "oai-authenticated-user-id": "reader",
          "oai-authenticated-user-email": "reader@example.test",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          "/settings",
          "POST",
          { settings: defaults },
          { ...owner, Origin: "https://other.test" },
        )
      ).status,
      403,
    );
    const read = await (await call("/settings")).json();
    assert.equal(read.providers[0].configured, true);
    assert.equal(JSON.stringify(read).includes("private-key"), false);
    assert.equal((await call("/chat", "POST", {})).status, 409);
    const document = defaultTheme();
    document.templates.home = root();
    const basis = { document, templateId: "home", part: "", kind: "Body" };
    const batchBody = {
      ...basis,
      revision: await editorRevision(basis),
      commands: [
        { type: "update", id: "paragraph", settings: { html: "Neutral API" } },
      ],
    };
    const neutral = (body) =>
      worker.fetch(
        new Request("https://cms.test/api/admin/editor/batch/preview", {
          method: "POST",
          headers: {
            ...owner,
            Origin: "https://cms.test",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }),
        env,
      );
    assert.equal((await neutral(batchBody)).status, 200);
    assert.equal(
      (
        await neutral({
          ...batchBody,
          commands: [
            {
              type: "update",
              id: "paragraph",
              settings: { unsupported: true },
            },
          ],
        })
      ).status,
      400,
    );
    await DB.prepare(
      "UPDATE plugins SET active=1,installed=1 WHERE id='com.colossal.ai-assistant'",
    ).run();
    assert.equal(
      (
        await call("/settings", "POST", {
          settings: {
            ...defaults,
            enabled: true,
            provider: "openai",
            models: { ...defaults.models, openai: "test-model" },
          },
        })
      ).status,
      200,
    );
    const originalFetcher = env.AI_FETCH;
    env.AI_FETCH = async () =>
      Response.json({
        data: [{ id: "test-model", owner: "private metadata" }],
      });
    const catalog = await (
      await call("/models", "POST", { provider: "openai" })
    ).json();
    assert.deepEqual(catalog.models, [
      { id: "test-model", label: "test-model" },
    ]);
    assert.equal(JSON.stringify(catalog).includes("private metadata"), false);
    assert.equal(
      (await call("/models", "POST", { provider: "gemini" })).status,
      409,
    );
    env.AI_FETCH = async (_url, options) => {
      assert.equal(options.headers["x-goog-api-key"], "temporary-key");
      return Response.json({
        models: [
          {
            name: "models/gemini-temp",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      });
    };
    const temporary = await call("/models", "POST", {
      provider: "gemini",
      apiKey: "temporary-key",
    });
    assert.equal(temporary.status, 200);
    assert.equal((await temporary.text()).includes("temporary-key"), false);
    assert.equal(
      (await (await call("/settings")).json()).providers.find(
        (p) => p.id === "gemini",
      ).configured,
      false,
    );
    env.CUSTOM_AI_API_KEY = "private-custom-key";
    env.CUSTOM_AI_BASE_URL = "https://api.original-provider.com/v1";
    assert.equal(
      (
        await call("/models", "POST", {
          provider: "custom",
          customBaseUrl: "https://api.other-provider.com/v1",
        })
      ).status,
      409,
    );
    env.AI_FETCH = originalFetcher;
    const response = await call("/chat", "POST", {
      message: "Help",
      context: { root: root(), catalog: definitions, revision: "r" },
    });
    assert.equal(response.status, 200);
    const events = (await response.text()).trim().split("\n").map(JSON.parse);
    assert.equal(events.at(-1).type, "proposal");
    assert.equal(events.at(-1).revision, "r");
    assert.equal(calls, 1);
    const status = await (await call("/status")).json();
    assert.equal(status.provider, "openai");
    assert.deepEqual(
      (await (await call("/models")).json()).models,
      catalog.models,
    );
    assert.equal(
      (
        await call("/chat", "POST", {
          model: "unlisted",
          message: "Help",
          context: { root: root(), catalog: definitions },
        })
      ).status,
      400,
    );
    assert.equal(JSON.stringify(status).includes("private-key"), false);
    assert.equal(
      (
        await call("/chat", "POST", {
          provider: "gemini",
          mode: "build",
          message: "Help",
          context: { root: root(), catalog: definitions },
        })
      ).status,
      409,
    );
    assert.equal(
      (await call("/chat", "POST", { mode: "unsupported", message: "Help" }))
        .status,
      400,
    );
    env.AI_FETCH = async (_url, options) => {
      assert.match(
        JSON.parse(options.body).instructions,
        /Return commands:\[\]/,
      );
      return streamResponse([
        {
          type: "response.output_text.delta",
          delta: JSON.stringify({
            message: "Plan only",
            commands: [{ type: "remove", id: "paragraph" }],
          }),
        },
      ]);
    };
    for (const mode of ["plan", "explain"]) {
      const discussion = await call("/chat", "POST", {
        mode,
        message: "Help",
        context: { root: root(), catalog: definitions, revision: "r" },
      });
      const final = (await discussion.text())
        .trim()
        .split("\n")
        .map(JSON.parse)
        .at(-1);
      assert.equal(final.type, "proposal");
      assert.deepEqual(final.commands, []);
    }
    const saved = await DB.prepare(
      "SELECT value FROM config WHERE id='ai-assistant'",
    ).first();
    assert.equal(saved.value.includes("private-key"), false);
    env.AI_FETCH = async () => {
      throw Error("request failed private-key");
    };
    const failed = await (
      await call("/chat", "POST", {
        message: "Help",
        context: { root: root(), catalog: definitions },
      })
    ).text();
    assert.equal(failed.includes("private-key"), false);
    const modelFailure = await call("/models", "POST", { provider: "openai" });
    assert.equal(modelFailure.status, 502);
    assert.equal((await modelFailure.text()).includes("private-key"), false);
    assert.match(failed, /"type":"error"/);
  } finally {
    DB.close();
  }
});

test("provider selection can be blank only while disabled and custom endpoints reject unsafe URLs", () => {
  assert.equal(validateSettings(defaults).provider, "");
  assert.throws(
    () => validateSettings({ ...defaults, enabled: true }),
    /provider/,
  );
  assert.equal(
    customEndpoint("https://api.example.com/v1/"),
    "https://api.example.com/v1",
  );
  for (const url of [
    "http://api.example.com",
    "https://127.0.0.1/v1",
    "https://localhost/v1",
    "https://host.internal/v1",
    "https://[::1]/v1",
    "https://user:pass@api.example.com/v1",
    "https://api.example.com/v1?key=secret",
  ])
    assert.throws(() => customEndpoint(url));
  assert.equal(
    validateSettings({
      ...defaults,
      enabled: true,
      provider: "custom",
      models: { ...defaults.models, custom: "vendor/model" },
    }).models.custom,
    "vendor/model",
  );
});

test("model fields accept provider names, aliases and namespaced IDs without coercing invalid input", () => {
  for (const provider of ["openai", "anthropic", "gemini", "custom"]) {
    for (const model of ["model-latest", "vendor/model:latest", "Model Name"]) {
      const settings = validateSettings({
        ...defaults,
        provider,
        enabled: true,
        models: { ...defaults.models, [provider]: "  " + model + "  " },
      });
      assert.equal(settings.models[provider], model);
    }
    for (const model of [{ name: "model" }, "bad\nmodel", "x".repeat(121)])
      assert.throws(() =>
        validateSettings({
          ...defaults,
          provider,
          models: { ...defaults.models, [provider]: model },
        }),
      );
  }
});

test("model catalogs paginate, normalize Gemini IDs, deduplicate and limit provider metadata", async () => {
  for (const provider of ["openai", "anthropic", "gemini", "custom"]) {
    let count = 0;
    const result = await providerModels(
      provider,
      "private-key",
      "https://api.example.com/v1",
      new AbortController().signal,
      async (url, options) => {
        count++;
        assert.equal(options.redirect, "error");
        assert.equal(url.includes("private-key"), false);
        if (provider === "gemini")
          return Response.json({
            models: [
              {
                name: "models/gemini-test",
                displayName: "Gemini test",
                supportedGenerationMethods: ["generateContent"],
              },
              {
                name: "models/embedding",
                supportedGenerationMethods: ["embedContent"],
              },
            ],
            ...(count === 1 ? { nextPageToken: "page-two" } : {}),
          });
        return Response.json({
          data: [
            {
              id: "test-model",
              display_name: "Test Model",
              irrelevant: "secret",
            },
          ],
          ...(provider === "anthropic" && count === 1
            ? { has_more: true, last_id: "test-model" }
            : {}),
        });
      },
    );
    assert.equal(result.models.length, 1);
    assert.equal(
      result.models[0].id,
      provider === "gemini" ? "gemini-test" : "test-model",
    );
    assert.equal(result.truncated, false);
    assert.equal(count, ["anthropic", "gemini"].includes(provider) ? 2 : 1);
    assert.equal(JSON.stringify(result).includes("secret"), false);
  }
});
