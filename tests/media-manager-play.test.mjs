import test from "node:test";
import assert from "node:assert/strict";
import {
  createPlayService,
  readBody,
} from "../plugins/media-manager-play/service.mjs";
import contribution from "../plugins/media-manager-play/server.mjs";
import { createPluginRegistry } from "../server/plugin-registry.mjs";
const encoder = new TextEncoder();
const b64 = (data) => Buffer.from(data).toString("base64");
const url64 = (data) => Buffer.from(data).toString("base64url");
const keys = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-1",
  },
  true,
  ["sign", "verify"],
);
const key = b64(await crypto.subtle.exportKey("spki", keys.publicKey));
const baseConfig = {
  publicKey: key,
  audience:
    "//iam.googleapis.com/projects/12345/locations/global/workloadIdentityPools/cms/providers/vercel",
  serviceAccount:
    "media-manager-play-verifier@portfolio-457414.iam.gserviceaccount.com",
  identityToken: async () => "hosting-oidc",
};
async function receipt(extra = {}) {
  const receipt = JSON.stringify({
    packageName: "com.tvshowmanager.app",
    productId: "remove_ads",
    purchaseToken: "private-test-token",
    quantity: 1,
    purchaseState: 4,
    ...extra,
  });
  return {
    receipt,
    signature: b64(
      await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        keys.privateKey,
        encoder.encode(receipt),
      ),
    ),
  };
}
function harness(state = "PURCHASED", extra = {}) {
  let now = Date.now(),
    acknowledgements = 0,
    queries = 0,
    requests = [];
  let result = {
    purchaseStateContext: { purchaseState: state },
    productLineItem: [
      {
        productId: "remove_ads",
        productOfferDetails: {
          quantity: 1,
          refundableQuantity: 1,
          consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
        },
      },
    ],
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    ...extra,
  };
  const service = createPlayService({
    clock: () => now,
    fetcher: async (url, options) => {
      requests.push(url);
      if (url === "https://sts.googleapis.com/v1/token")
        return Response.json({ access_token: "sts-test" });
      if (url.includes(":generateAccessToken"))
        return Response.json({
          accessToken: "publisher-test",
          expireTime: new Date(now + 600000).toISOString(),
        });
      if (url.includes(":acknowledge")) {
        acknowledgements++;
        return new Response(null, { status: 204 });
      }
      queries++;
      return result instanceof Response ? result : Response.json(result);
    },
  });
  return {
    service,
    requests,
    ack: () => acknowledgements,
    queries: () => queries,
    set: (value) => (result = value),
    advance: () => (now += 4000),
  };
}
test("signed pending receipt can discover completion on Google and acknowledge once", async () => {
  const h = harness();
  const value = await h.service.verify(await receipt(), baseConfig);
  assert.equal(value.owned, true);
  assert.equal(value.acknowledged, true);
  assert.equal(h.ack(), 1);
  assert.equal(JSON.stringify(value).includes("private-test-token"), false);
  assert.ok(h.requests.every((url) => url.startsWith("https://")));
});
test("pending and canceled payments never acknowledge or grant ownership", async () => {
  for (const state of ["PENDING", "CANCELLED"]) {
    const h = harness(state);
    const value = await h.service.verify(
      await receipt({ purchaseState: 0 }),
      baseConfig,
    );
    assert.equal(value.owned, false);
    assert.equal(value.state, state);
    assert.equal(h.ack(), 0);
  }
});
test("refunds override old signed purchased receipts; no ownership cache", async () => {
  const h = harness();
  const proof = await receipt({ purchaseState: 0 });
  assert.equal((await h.service.verify(proof, baseConfig)).owned, true);
  h.advance();
  h.set({
    purchaseStateContext: { purchaseState: "PURCHASED" },
    productLineItem: [
      {
        productId: "remove_ads",
        productOfferDetails: {
          quantity: 1,
          refundableQuantity: 0,
          consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
        },
      },
    ],
  });
  assert.equal((await h.service.verify(proof, baseConfig)).owned, false);
  assert.equal(h.queries(), 2);
});
test("tampering and foreign package/product fail before any Google request", async () => {
  for (const proof of [
    await receipt({ packageName: "wrong.app" }),
    await receipt({ productId: "wrong" }),
    await receipt({ quantity: 2 }),
    { ...(await receipt()), receipt: "tampered" },
  ]) {
    const h = harness();
    await assert.rejects(
      () => h.service.verify(proof, baseConfig),
      (error) => error.status === 401,
    );
    assert.equal(h.requests.length, 0);
  }
});
test("unknown token revokes; Google authorization/network failures are retryable, not false revocations", async () => {
  const h = harness();
  h.set(new Response(null, { status: 410 }));
  assert.equal(
    (await h.service.verify(await receipt(), baseConfig)).owned,
    false,
  );
  const failed = harness();
  failed.set(new Response(null, { status: 403 }));
  await assert.rejects(
    async () => failed.service.verify(await receipt(), baseConfig),
    (error) => error.status === 503,
  );
  const offline = createPlayService({
    fetcher: async () => {
      throw Error("secret upstream detail");
    },
  });
  await assert.rejects(
    async () => offline.verify(await receipt(), baseConfig),
    (error) => error.status === 503 && !error.message.includes("secret"),
  );
});
test("duplicate checks are throttled, but retry gets fresh Google state", async () => {
  const h = harness("PENDING");
  const proof = await receipt();
  await h.service.verify(proof, baseConfig);
  await assert.rejects(
    () => h.service.verify(proof, baseConfig),
    (error) => error.status === 429,
  );
  h.advance();
  await h.service.verify(proof, baseConfig);
  assert.equal(h.queries(), 2);
});
test("already acknowledged purchases are not acknowledged again; unrelated products fail closed", async () => {
  const h = harness("PURCHASED", {
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
  });
  assert.equal(
    (await h.service.verify(await receipt(), baseConfig)).owned,
    true,
  );
  assert.equal(h.ack(), 0);
  const wrong = harness("PURCHASED", {
    productLineItem: [{ productId: "other" }],
  });
  await assert.rejects(
    async () => wrong.service.verify(await receipt(), baseConfig),
    (error) => error.status === 503,
  );
});
test("JSON reader enforces actual streamed size and supported content type", async () => {
  await assert.rejects(
    () =>
      readBody(new Request("https://cms.test", { method: "POST", body: "{}" })),
    (error) => error.status === 415,
  );
  await assert.rejects(
    () =>
      readBody(
        new Request("https://cms.test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: "a".repeat(25000) }),
        }),
      ),
    (error) => error.status === 413,
  );
});
test("disabled and inactive public routes cannot reach the provider; status is administrator-only", async () => {
  const registry = createPluginRegistry([contribution]);
  for (const active of [false, true]) {
    const db = {
      prepare: (sql) => ({
        bind() {
          return this;
        },
        first: async () =>
          sql.includes("FROM plugins")
            ? { installed: 1, active }
            : { value: '{"enabled":false}' },
      }),
    };
    const response = await registry.dispatch("public", {
      path: "/api/media-manager/play/verify",
      request: new Request("https://cms.test/api/media-manager/play/verify", {
        method: "POST",
      }),
      database: () => db,
      env: {},
    });
    assert.equal(response.status, 503);
  }
  await assert.rejects(
    () =>
      registry.dispatch("admin", {
        path: "/api/admin/media-manager-play",
        request: new Request("https://cms.test"),
        user: { role: "editor" },
      }),
    (error) => error.status === 403,
  );
});
test("Pub/Sub rejects forged identities before reading notification tokens", async () => {
  const h = harness();
  let read = false;
  const config = {
    ...baseConfig,
    pushAudience: "https://cms.test/api/media-manager/play/notifications",
    pushEmail: "play-push@portfolio-457414.iam.gserviceaccount.com",
    subscription: "projects/portfolio-457414/subscriptions/play",
  };
  await assert.rejects(
    () =>
      h.service.notification(
        new Request(config.pushAudience, { method: "POST" }),
        async () => {
          read = true;
          return {};
        },
        config,
      ),
    (error) => error.status === 401,
  );
  assert.equal(read, false);
  assert.equal(h.requests.length, 0);
});
test("authenticated Pub/Sub rechecks authoritative state and handles replay without granting from event", async () => {
  const now = Date.now();
  const pushKeys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = {
    ...(await crypto.subtle.exportKey("jwk", pushKeys.publicKey)),
    kid: "test-key",
    alg: "RS256",
  };
  const config = {
    ...baseConfig,
    pushAudience: "https://cms.test/api/media-manager/play/notifications",
    pushEmail: "play-push@portfolio-457414.iam.gserviceaccount.com",
    subscription: "projects/portfolio-457414/subscriptions/play",
  };
  async function token(extra = {}) {
    const data =
      url64(JSON.stringify({ alg: "RS256", kid: "test-key" })) +
      "." +
      url64(
        JSON.stringify({
          iss: "https://accounts.google.com",
          aud: config.pushAudience,
          email: config.pushEmail,
          email_verified: true,
          iat: Math.floor(now / 1000),
          exp: Math.floor(now / 1000) + 3600,
          ...extra,
        }),
      );
    return (
      data +
      "." +
      url64(
        await crypto.subtle.sign(
          "RSASSA-PKCS1-v1_5",
          pushKeys.privateKey,
          encoder.encode(data),
        ),
      )
    );
  }
  let queries = 0;
  const service = createPlayService({
    clock: () => now,
    fetcher: async (url) => {
      if (url.includes("/certs")) return Response.json({ keys: [jwk] });
      if (url.includes("/v1/token"))
        return Response.json({ access_token: "sts-test" });
      if (url.includes(":generateAccessToken"))
        return Response.json({
          accessToken: "publisher-test",
          expireTime: new Date(now + 600000).toISOString(),
        });
      queries++;
      return Response.json({
        purchaseStateContext: { purchaseState: "CANCELLED" },
        productLineItem: [{ productId: "remove_ads" }],
      });
    },
  });
  const body = () =>
    Promise.resolve({
      subscription: config.subscription,
      message: {
        data: b64(
          JSON.stringify({
            packageName: "com.tvshowmanager.app",
            oneTimeProductNotification: {
              sku: "remove_ads",
              purchaseToken: "private-test-token",
              notificationType: 1,
            },
          }),
        ),
      },
    });
  const request = new Request(config.pushAudience, {
    method: "POST",
    headers: { Authorization: "Bearer " + (await token()) },
  });
  await service.notification(request, body, config);
  await service.notification(request, body, config);
  assert.equal(queries, 2);
  for (const extra of [
    { aud: "wrong" },
    { email: "attacker@example.com" },
    { exp: 0 },
    { iss: "https://evil.test" },
  ])
    await assert.rejects(
      async () =>
        service.notification(
          new Request(config.pushAudience, {
            method: "POST",
            headers: { Authorization: "Bearer " + (await token(extra)) },
          }),
          body,
          config,
        ),
      (error) => error.status === 401,
    );
});

test("incomplete provider data is retryable rather than falsely revoking a purchase", async () => {
  const h = harness("PURCHASED", {
    productLineItem: [{ productId: "remove_ads" }],
  });
  await assert.rejects(
    async () => h.service.verify(await receipt(), baseConfig),
    (error) => error.status === 503,
  );
});
test("failed acknowledgement never reports an acknowledged entitlement", async () => {
  const service = createPlayService({
    fetcher: async (url) => {
      if (url.includes("/v1/token"))
        return Response.json({ access_token: "sts-test" });
      if (url.includes(":generateAccessToken"))
        return Response.json({
          accessToken: "publisher-test",
          expireTime: new Date(Date.now() + 600000).toISOString(),
        });
      if (url.includes(":acknowledge"))
        return new Response(null, { status: 503 });
      return Response.json({
        purchaseStateContext: { purchaseState: "PURCHASED" },
        productLineItem: [
          {
            productId: "remove_ads",
            productOfferDetails: {
              quantity: 1,
              refundableQuantity: 1,
              consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
            },
          },
        ],
      });
    },
  });
  await assert.rejects(
    async () => service.verify(await receipt(), baseConfig),
    (error) => error.status === 503,
  );
});
