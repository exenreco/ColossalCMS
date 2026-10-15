import test from "node:test";
import assert from "node:assert/strict";
import { inspectMedia } from "../server/media.mjs";
const inspect = (body, attributes = "") =>
  inspectMedia(
    new TextEncoder().encode(
      `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="540" ${attributes}>${body}</svg>`,
    ),
    "project-cms.svg",
    "image/svg+xml",
  );

test("static SVG media supports internal gradients, clips, quoted references and local use", () => {
  for (const fill of [
    "url(#bg)",
    "url( '#bg' )",
    "url(&quot;#bg&quot;)",
    "url(&#35;bg)",
  ]) {
    const result = inspect(
      `<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#8d9eae"/><stop offset="1" stop-color="#3b4655"/></linearGradient><clipPath id="clip"><rect width="500" height="400"/></clipPath></defs><rect width="720" height="540" fill="${fill}" clip-path="url(#clip)"/><use href="#clip"/>`,
    );
    assert.equal(result.mime, "image/svg+xml");
    assert.equal(result.metadata.width, 720);
    assert.equal(result.metadata.height, 540);
  }
});

test("SVG upload still rejects scripts, animation, external resources and obfuscated URL references", () => {
  for (const body of [
    "<script>alert(1)</script>",
    '<rect onload="alert(1)"/>',
    '<animate attributeName="x"/>',
    "<foreignObject><div>HTML</div></foreignObject>",
    '<rect style="fill:url(#bg)"/>',
    '<rect fill="url(https://example.com/image.svg#bg)"/>',
    '<rect fill="url(//example.com/image.svg#bg)"/>',
    '<rect fill="url(/image.svg#bg)"/>',
    '<rect fill="url(#bg) url(https://example.com/x)"/>',
    '<rect fill="u&#114;l(https://example.com/x)"/>',
    '<rect fill="&#117;rl(https://example.com/x)"/>',
    '<rect fill="u\\72l(https://example.com/x)"/>',
    '<rect fill="url(/**/https://example.com/x)"/>',
    '<use href="https://example.com/image.svg#bg"/>',
    '<use href="&#104;ttps://example.com/image.svg#bg"/>',
    '<use href="data:image/svg+xml,test"/>',
    '<image href="https://example.com/image.png"/>',
  ])
    assert.throws(() => inspect(body), /SVG|Unsupported/, body);
  assert.throws(
    () => inspect('<rect fill="url(#bg)"/>', 'xml:base="https://example.com/"'),
    /SVG/,
  );
  assert.throws(
    () =>
      inspectMedia(
        new TextEncoder().encode(
          '<!DOCTYPE svg [<!ENTITY remote SYSTEM "https://example.com/x">]><svg width="10" height="10"/>',
        ),
        "unsafe.svg",
        "image/svg+xml",
      ),
    /SVG/,
  );
});
