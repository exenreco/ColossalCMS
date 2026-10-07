import test from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import worker from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { createVercelHandler } from "../scripts/vercel-handler.mjs";
import { readWorkspaceStream } from "../shared/workspace-progress.ts";

const owner = {
  "oai-authenticated-user-id": "owner",
  "oai-authenticated-user-email": "owner@example.test",
};
const request = (headers = owner) =>
  new Request("https://cms.test/api/admin/bootstrap", { headers });
async function ownerDatabase() {
  const db = localDatabase();
  await db
    .prepare(
      "INSERT INTO members (id,email,role) VALUES ('owner','owner@example.test','admin')",
    )
    .run();
  return db;
}
function pauseSiteCheck(db, wait) {
  return {
    ...db,
    prepare(sql) {
      const statement = db.prepare(sql);
      if (sql === "SELECT id FROM config WHERE id='site'") {
        const first = statement.first.bind(statement);
        statement.first = async () => {
          await wait();
          return first();
        };
      }
      return statement;
    },
  };
}

test("workspace progress reflects completed database operations before state is available", async () => {
  const db = await ownerDatabase();
  let release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  const DB = pauseSiteCheck(db, () => wait);
  try {
    const response = await worker.fetch(request(), { DB, PASSWORD_AUTH: true });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type"), /application\/x-ndjson/);
    assert.match(response.headers.get("Cache-Control"), /no-store/);
    const reader = response.body.getReader();
    const events = [];
    for (let i = 0; i < 3; i++)
      events.push(
        JSON.parse(new TextDecoder().decode((await reader.read()).value)),
      );
    assert.deepEqual(
      events.map((e) => e.completed),
      [0, 1, 2],
    );
    assert.equal(
      events[2].message,
      "Preparing site settings and built-in content…",
    );
    assert.equal(events[0].passwordAuth, true);
    assert.equal(
      await db.prepare("SELECT id FROM config WHERE id='site'").first(),
      null,
    );
    assert.ok(
      (await db.prepare("SELECT * FROM plugins").all()).results.length > 0,
    );
    release();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      events.push(JSON.parse(new TextDecoder().decode(chunk.value)));
    }
    assert.deepEqual(
      events.filter((e) => e.type === "progress").map((e) => e.completed),
      [0, 1, 2, 3, 4],
    );
    const ready = events.at(-1);
    assert.equal(ready.type, "complete");
    assert.equal(ready.state.user.role, "admin");
    assert.equal(ready.state.content.length, 3);
    const setting = await db
      .prepare("SELECT value FROM config WHERE id='site'")
      .first();
    await db
      .prepare("UPDATE config SET value=? WHERE id='site'")
      .bind(
        JSON.stringify({ ...JSON.parse(setting.value), title: "Keep my site" }),
      )
      .run();
    const repeated = await readWorkspaceStream(
      await worker.fetch(request(), { DB }),
      () => {},
    );
    assert.equal(repeated.state.settings.title, "Keep my site");
    assert.equal(repeated.state.content.length, 3);
  } finally {
    release();
    db.close();
  }
});

test("failed bootstrap preserves completed operations, withholds secrets, and can retry", async () => {
  const db = await ownerDatabase();
  let fail = true;
  const DB = pauseSiteCheck(db, async () => {
    if (fail)
      throw new Error("mongodb://owner:secret@private.test/ColossalCMS");
  });
  try {
    const milestones = [];
    await assert.rejects(
      readWorkspaceStream(await worker.fetch(request(), { DB }), (event) =>
        milestones.push(event.completed),
      ),
      /Check your database connection/,
    );
    assert.deepEqual(milestones, [0, 1, 2]);
    const response = await worker.fetch(request(), { DB });
    assert.doesNotMatch(
      await response.text(),
      /owner:secret|private\.test|mongodb:\/\//,
    );
    fail = false;
    const result = await readWorkspaceStream(
      await worker.fetch(request(), { DB }),
      () => {},
    );
    assert.equal(result.state.content.length, 3);
  } finally {
    db.close();
  }
});

test("bootstrap requires a verified member and preserves the legacy setup response", async () => {
  const db = localDatabase();
  try {
    assert.equal((await worker.fetch(request({}), { DB: db })).status, 401);
    assert.equal(
      (
        await readWorkspaceStream(
          await worker.fetch(request(), { DB: db }),
          () => {},
        )
      ).setup,
      true,
    );
    await db
      .prepare(
        "INSERT INTO members (id,email,role) VALUES ('owner','owner@example.test','admin')",
      )
      .run();
    const editorHeaders = {
      "oai-authenticated-user-id": "editor",
      "oai-authenticated-user-email": "editor@example.test",
    };
    await db
      .prepare(
        "INSERT INTO members (id,email,role) VALUES ('editor','editor@example.test','editor')",
      )
      .run();
    const editor = await readWorkspaceStream(
      await worker.fetch(request(editorHeaders), { DB: db }),
      () => {},
    );
    assert.equal(editor.state.user.role, "editor");
    assert.deepEqual(editor.state.members, []);
    assert.deepEqual(editor.state.keys, []);
  } finally {
    db.close();
  }
});

test("Vercel forwards progress before the database job finishes instead of buffering it", async () => {
  const db = await ownerDatabase();
  let release, firstChunk;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  const received = new Promise((resolve) => {
    firstChunk = resolve;
  });
  const DB = pauseSiteCheck(db, () => wait);
  const handler = createVercelHandler(
    { CMS_PUBLIC_URL: "https://cms.test" },
    async () => ({
      DB,
      PASSWORD_AUTH: true,
      AUTH: {
        identify: async () => ({ id: "owner", email: "owner@example.test" }),
      },
    }),
  );
  const chunks = [];
  const res = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(chunk);
      firstChunk(chunk.toString());
      callback();
    },
  });
  let status,
    headers,
    finished = false;
  res.writeHead = (code, values) => {
    status = code;
    headers = new Headers(values);
  };
  res.flushHeaders = () => {};
  const running = handler(
    {
      url: "/api/cms?__cmsPath=/api/admin/bootstrap",
      method: "GET",
      headers: {},
      socket: { remoteAddress: "test-client" },
    },
    res,
  ).then(() => {
    finished = true;
  });
  try {
    assert.match(await received, /"completed":0/);
    assert.equal(finished, false);
    assert.equal(status, 200);
    assert.equal(headers.get("Cache-Control"), "no-store, no-transform");
    release();
    await running;
    assert.match(Buffer.concat(chunks).toString(), /"type":"complete"/);
  } finally {
    release();
    await running;
    db.close();
  }
});

test("progress decoding handles fragmented UTF-8 and rejects interrupted completion", async () => {
  const events = [0, 1, 2, 3, 4].map((completed) => ({
    type: "progress",
    completed,
    total: 4,
    message: "Preparing…",
  }));
  events.push({
    type: "complete",
    state: { user: { role: "admin" }, plugins: [] },
    passwordAuth: true,
  });
  const bytes = new TextEncoder().encode(
    events.map((e) => JSON.stringify(e)).join("\n") + "\n",
  );
  const response = new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 2)
          controller.enqueue(bytes.slice(i, i + 2));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "application/x-ndjson" } },
  );
  const messages = [];
  assert.equal(
    (
      await readWorkspaceStream(response, (event) =>
        messages.push(event.message),
      )
    ).passwordAuth,
    true,
  );
  assert.deepEqual(messages, Array(5).fill("Preparing…"));
  await assert.rejects(
    readWorkspaceStream(
      new Response(JSON.stringify(events[0]) + "\n", {
        headers: { "Content-Type": "application/x-ndjson" },
      }),
      () => {},
    ),
    /interrupted/,
  );
});
