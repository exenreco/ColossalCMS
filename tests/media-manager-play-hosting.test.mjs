import test from "node:test";
import assert from "node:assert/strict";
import {
  playHosting,
  playRequestHosting,
} from "../plugins/media-manager-play/hosting.mjs";

test("Vercel invocation identity replaces build tokens and stays request-local", async () => {
  const shared = playHosting({ VERCEL_OIDC_TOKEN: "expired-build-token" });
  const one = playRequestHosting(
    shared,
    { "x-vercel-oidc-token": "invocation-one" },
    true,
  );
  const two = playRequestHosting(
    shared,
    { "x-vercel-oidc-token": "invocation-two" },
    true,
  );
  assert.deepEqual(
    await Promise.all([one.identityToken(), two.identityToken()]),
    ["invocation-one", "invocation-two"],
  );
  assert.equal(shared.identityToken(), "expired-build-token");
});

test("Missing or ambiguous invocation identity fails closed without a build-token fallback", () => {
  const shared = playHosting({ VERCEL_OIDC_TOKEN: "expired-build-token" });
  for (const value of [undefined, ["one", "two"], "x".repeat(20001)]) {
    assert.equal(
      playRequestHosting(
        shared,
        { "x-vercel-oidc-token": value },
        true,
      ).identityToken(),
      "",
    );
  }
});

test("Standalone hosts ignore an untrusted Vercel identity header", () => {
  const shared = playHosting({ VERCEL_OIDC_TOKEN: "explicit-local-token" });
  assert.equal(
    playRequestHosting(shared, { "x-vercel-oidc-token": "untrusted" }, false),
    shared,
  );
});
