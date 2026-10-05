import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMongoDnsServers,
  createMongoDnsConfigurator,
} from "../scripts/mongo-dns.mjs";
import {
  validateConnectionConfig,
  connectionDefaults,
} from "../scripts/connection-manager.mjs";

test("MongoDB DNS validates IP lists and supports explicit system DNS", () => {
  assert.deepEqual(parseMongoDnsServers(), ["1.1.1.1", "8.8.8.8"]);
  assert.deepEqual(
    parseMongoDnsServers(" 1.1.1.1, 2001:4860:4860::8888,1.1.1.1 "),
    ["1.1.1.1", "2001:4860:4860::8888"],
  );
  assert.equal(parseMongoDnsServers(""), null);
  for (const value of [
    "dns.example",
    "999.1.1.1",
    "1.1.1.1,",
    "1.1.1.1:53",
    "1.1.1.1,2.2.2.2,3.3.3.3,4.4.4.4,5.5.5.5",
    null,
  ])
    assert.throws(() => parseMongoDnsServers(value));
  assert.throws(
    () =>
      validateConnectionConfig({
        ...connectionDefaults,
        MONGODB_DNS_SERVERS: "invalid",
      }),
    /DNS server IP/,
  );
});

test("Node resolver is configured before connections and unchanged for repeated clients", () => {
  const calls = [],
    logs = [];
  const configure = createMongoDnsConfigurator(
    (servers) => calls.push(servers),
    ["192.0.2.1"],
  );
  configure({}, (message) => logs.push(message));
  configure({ MONGODB_DNS_SERVERS: "1.1.1.1,8.8.8.8" });
  assert.deepEqual(calls, [["1.1.1.1", "8.8.8.8"]]);
  assert.ok(logs[0].includes("1.1.1.1"));
  assert.throws(
    () => configure({ MONGODB_DNS_SERVERS: "" }),
    (error) => error.code === "CMS_DNS_RESTART",
  );
  const systemCalls = [];
  createMongoDnsConfigurator(
    (servers) => systemCalls.push(servers),
    ["192.0.2.1"],
  )({ MONGODB_DNS_SERVERS: "" });
  assert.deepEqual(systemCalls, [["192.0.2.1"]]);
});
