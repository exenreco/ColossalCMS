import test from "node:test";
import assert from "node:assert/strict";
import { validateDetails } from "../server/v2-utils.mjs";

test("page order defaults to zero, persists whole numbers and rejects invalid values", async () => {
  assert.equal((await validateDetails({}, {})).order, 0);
  for (const order of [-3, 0, 7])
    assert.equal((await validateDetails({}, { order })).order, order);
  for (const order of [0.5, "2", Infinity, Number.MAX_SAFE_INTEGER + 1])
    await assert.rejects(validateDetails({}, { order }), /whole number/);
});
