import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

test("AdSense loader waits for visible space, loads once, and initializes each unit once", async () => {
  const source = ts.transpileModule(
    readFileSync(
      new URL("../shared/google-ads-host.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    },
  ).outputText;
  const original = Object.fromEntries(
    ["document", "window", "ResizeObserver", "IntersectionObserver"].map(
      (name) => [name, globalThis[name]],
    ),
  );
  const scripts = [];
  const resize = [];
  const intersections = [];
  const pushed = [];
  const element = () => ({
    dataset: {},
    style: {},
    isConnected: true,
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
  });
  const host = (width = 600) => ({
    ...element(),
    clientWidth: width,
    dataset: {
      googleAdClient: "ca-pub-1234567890123456",
      googleAdSlot: "1234567890",
      googleAdFormat: "rectangle",
      googleAdSizing: "responsive",
    },
    replaceChildren(child) {
      this.child = child;
    },
  });
  const hosts = [host(), host(0), host()];
  try {
    globalThis.document = {
      createElement: element,
      head: {
        appendChild(script) {
          scripts.push(script);
        },
      },
    };
    globalThis.window = {
      adsbygoogle: {
        push(value) {
          pushed.push(value);
        },
      },
    };
    globalThis.ResizeObserver = class {
      constructor(callback) {
        this.callback = callback;
        resize.push(this);
      }
      observe() {}
      disconnect() {
        this.disconnected = true;
      }
    };
    globalThis.IntersectionObserver = class {
      constructor(callback) {
        this.callback = callback;
        intersections.push(this);
      }
      observe() {}
      disconnect() {
        this.disconnected = true;
      }
    };
    const { hydrateAds } = await import(
      "data:text/javascript;base64," + Buffer.from(source).toString("base64")
    );
    const root = { querySelectorAll: () => hosts };
    hydrateAds(root);
    assert.equal(scripts.length, 0);
    intersections[0].callback([{ isIntersecting: true }]);
    intersections[1].callback([{ isIntersecting: true }]);
    intersections[2].callback([{ isIntersecting: true }]);
    assert.equal(scripts.length, 1);
    assert.equal(hosts[1].child, undefined);
    assert.equal(
      scripts[0].src,
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456",
    );
    assert.equal(hosts[0].child.dataset.adFormat, "rectangle");
    scripts[0].listeners.load();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(pushed.length, 2);
    hosts[1].clientWidth = 400;
    resize[1].callback();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(pushed.length, 3);
    hydrateAds(root);
    resize[0].callback();
    assert.equal(scripts.length, 1);
    assert.equal(pushed.length, 3);
    assert.equal(
      resize.every((observer) => observer.disconnected),
      true,
    );
    assert.equal(
      intersections.every((observer) => observer.disconnected),
      true,
    );
  } finally {
    for (const [name, value] of Object.entries(original))
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
  }
});
