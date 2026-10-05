import test from "node:test";
import assert from "node:assert/strict";
import { connectionFailure } from "../scripts/connection-errors.mjs";

test("connection errors give actionable diagnoses without leaking provider messages", () => {
  assert.match(
    connectionFailure({
      code: 8000,
      message: "not authorized on private-database private-secret",
    }),
    /denied this operation/,
  );
  assert.doesNotMatch(
    connectionFailure({ code: 8000, message: "not allowed private-secret" }),
    /private-secret/,
  );
  assert.match(
    connectionFailure({
      code: 8000,
      codeName: "AtlasError",
      message: "bad auth : authentication failed private-secret",
    }),
    /authentication failed/,
  );
  assert.doesNotMatch(
    connectionFailure({ code: 8000, message: "bad auth private-secret" }),
    /private-secret/,
  );
  assert.match(
    connectionFailure({
      code: 8000,
      message: "Another Atlas error private-secret",
    }),
    /Raw provider errors/,
  );
  assert.match(
    connectionFailure({ code: "ECONNREFUSED", syscall: "querySrv" }),
    /DNS/,
  );
  const cases = [
    [{ code: 18 }, /authentication failed/],
    [{ code: 13 }, /denied/],
    [{ code: "ENOTFOUND" }, /DNS/],
    [{ code: "ERR_TLS_CERT_ALTNAME_INVALID" }, /TLS/],
    [{ code: "CMS_MONGO_REPLICA_SET" }, /standalone/],
    [{ code: 11000 }, /duplicate/],
    [{ code: 121 }, /schema/],
    [{ name: "MongoParseError" }, /URI is invalid/],
    [{ name: "MongoServerSelectionError" }, /Network Access/],
    [{}, /Raw provider errors/],
  ];
  for (const [details, pattern] of cases) {
    const error = Object.assign(
      new Error("mongodb://private-user:private-password@secret-host/"),
      details,
    );
    const message = connectionFailure(error);
    assert.match(message, pattern);
    assert.doesNotMatch(message, /private-user|private-password|secret-host/);
  }
  assert.match(
    connectionFailure({
      name: "MongoServerSelectionError",
      reason: {
        servers: new Map([
          ["private-host", { error: { cause: { code: "ENOTFOUND" } } }],
        ]),
      },
    }),
    /DNS/,
  );
  const cycle = { cause: null };
  cycle.cause = cycle;
  assert.match(connectionFailure(cycle), /Raw provider errors/);
});
