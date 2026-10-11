import test from "node:test";
import assert from "node:assert/strict";
import worker from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";

test("editor preferences persist per authenticated member with origin and field validation", async () => {
  const DB = localDatabase();
  const call = (
    method = "GET",
    body,
    email = "editor-owner@example.test",
    origin = "https://cms.test",
  ) =>
    worker.fetch(
      new Request("https://cms.test/api/admin/editor/preferences", {
        method,
        headers: {
          "oai-authenticated-user-id": email,
          "oai-authenticated-user-email": email,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      { DB },
    );
  try {
    await DB.prepare(
      "INSERT INTO members (id,email,role) VALUES ('owner','editor-owner@example.test','admin'),('author','author@example.test','editor')",
    ).run();
    assert.deepEqual(await (await call()).json(), {
      colorMode: "dark",
      walkthroughVersion: 0,
    });
    assert.equal(
      (await call("PUT", { colorMode: "light", walkthroughVersion: 1 })).status,
      200,
    );
    assert.deepEqual(await (await call()).json(), {
      colorMode: "light",
      walkthroughVersion: 1,
    });
    assert.deepEqual(
      await (await call("GET", undefined, "author@example.test")).json(),
      { colorMode: "dark", walkthroughVersion: 0 },
    );
    assert.equal(
      (await call("PUT", { colorMode: "light" }, "author@example.test")).status,
      200,
    );
    assert.equal(
      (
        await call(
          "PUT",
          { userId: "owner", walkthroughVersion: 1 },
          "author@example.test",
        )
      ).status,
      400,
    );
    assert.equal((await call("PUT", { colorMode: "blue" })).status, 400);
    assert.equal((await call("PUT", { walkthroughVersion: 0 })).status, 400);
    assert.equal(
      (
        await call(
          "PUT",
          { colorMode: "dark" },
          undefined,
          "https://other.test",
        )
      ).status,
      403,
    );
    assert.equal(
      (await call("GET", undefined, "stranger@example.test")).status,
      403,
    );
    assert.deepEqual(await (await call()).json(), {
      colorMode: "light",
      walkthroughVersion: 1,
    });
  } finally {
    DB.close();
  }
});
