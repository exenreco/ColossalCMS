import test from "node:test";
import assert from "node:assert/strict";
import { createPluginRegistry } from "../server/plugin-registry.mjs";

test("registry dispatch respects scope, methods, prefix boundaries, permissions and fallback", async () => {
  let called = 0;
  const registry = createPluginRegistry([
    {
      id: "test.plugin",
      routes: [
        {
          scope: "admin",
          prefix: "/api/admin/example",
          methods: ["GET"],
          admin: true,
          handle: () => {
            called++;
            return Response.json({ ok: true });
          },
        },
        {
          scope: "public",
          path: "/example.txt",
          methods: ["GET"],
          handle: () => null,
        },
      ],
    },
  ]);
  const ctx = (path, method = "GET", user) => ({
    path,
    request: new Request("https://cms.test" + path, { method }),
    user,
  });
  assert.equal(
    await registry.dispatch("public", ctx("/api/admin/example")),
    null,
  );
  assert.equal(
    await registry.dispatch(
      "admin",
      ctx("/api/admin/examples", "GET", { role: "admin" }),
    ),
    null,
  );
  assert.equal(
    await registry.dispatch(
      "admin",
      ctx("/api/admin/example", "POST", { role: "admin" }),
    ),
    null,
  );
  await assert.rejects(registry.dispatch("admin", ctx("/api/admin/example")), {
    status: 401,
  });
  await assert.rejects(
    registry.dispatch(
      "admin",
      ctx("/api/admin/example", "GET", { role: "editor" }),
    ),
    { status: 403 },
  );
  assert.equal(called, 0);
  assert.equal(
    (
      await registry.dispatch(
        "admin",
        ctx("/api/admin/example/nested", "GET", { role: "admin" }),
      )
    ).status,
    200,
  );
  assert.equal(called, 1);
  assert.equal(await registry.dispatch("public", ctx("/example.txt")), null);
});

test("registry prevents ambiguous ownership and core block replacement", async () => {
  const route = {
    scope: "public",
    path: "/example",
    methods: ["GET"],
    handle: () => new Response("ok"),
  };
  assert.throws(
    () => createPluginRegistry([{ id: "one" }, { id: "one" }]),
    /Duplicate/,
  );
  assert.throws(
    () =>
      createPluginRegistry([
        { id: "one", routes: [route] },
        { id: "two", routes: [route] },
      ]),
    /Conflicting/,
  );
  assert.throws(
    () =>
      createPluginRegistry([
        { id: "one", routes: [{ ...route, prefix: "/example" }] },
      ]),
    /Invalid/,
  );
  assert.throws(
    () =>
      createPluginRegistry([
        { id: "one", blockRenderers: { "core/paragraph": () => "" } },
      ]),
    /Invalid/,
  );
  assert.throws(
    () =>
      createPluginRegistry([
        { id: "one", blockRenderers: { "example/ad": () => "" } },
        { id: "two", blockRenderers: { "example/ad": () => "" } },
      ]),
    /duplicate/,
  );
});

test("hooks preserve registration order, support empty block output and propagate handler failures", async () => {
  const registry = createPluginRegistry([
    {
      id: "one",
      metadata: async () => "<meta name=one>",
      document: async () => null,
      blockRenderers: { "example/hidden": () => "" },
    },
    {
      id: "two",
      metadata: async () => "<meta name=two>",
      document: async () => ({ status: 503 }),
      routes: [
        {
          scope: "public",
          path: "/failure",
          methods: ["GET"],
          handle: () => {
            throw new Error("Expected failure");
          },
        },
      ],
    },
  ]);
  assert.equal(await registry.metadata({}), "<meta name=one><meta name=two>");
  assert.deepEqual(await registry.document({}), { status: 503 });
  assert.equal(registry.renderBlock("example/hidden", {}, {}, {}), "");
  assert.equal(registry.renderBlock("core/paragraph", {}, {}, {}), undefined);
  await assert.rejects(
    registry.dispatch("public", {
      path: "/failure",
      request: new Request("https://cms.test/failure"),
    }),
    /Expected failure/,
  );
});
