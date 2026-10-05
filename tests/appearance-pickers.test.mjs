import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultTheme,
  renderTheme,
  validateDocument,
} from "../server/theme-engine.mjs";

test("appearance picker settings compile into safe canvas and public styles", () => {
  const document = defaultTheme();
  document.templates.default.children.splice(1, 0, {
    id: "picker-heading",
    type: "core/heading",
    settings: {
      text: "Picker example",
      color: "#123456",
      backgroundGradient: {
        type: "linear",
        angle: 45,
        start: "#ffffff",
        end: "#000000",
      },
      padding: { top: 4, right: 8, bottom: 12, left: 16 },
      fontFamily: "Georgia",
      fontSize: 28,
      lineHeight: 36,
      textIndent: 10,
      borderColor: "#ff0000",
      borderSides: { top: 1, right: 2, bottom: 3, left: 4 },
      radiusCorners: {
        topLeft: 3,
        topRight: 6,
        bottomRight: 9,
        bottomLeft: 12,
      },
      animations: {
        In: { preset: "fade", event: "load", duration: 300, delay: 100 },
      },
    },
  });
  const rendered = renderTheme(validateDocument(document, true), {
    kind: "page",
    content: { title: "Test", body: "" },
    settings: { title: "Site", tagline: "" },
    allContent: [],
    media: [],
  });
  assert.match(rendered.html, /font-family:'Georgia'/);
  assert.match(rendered.html, /font-size:28px/);
  assert.match(
    rendered.html,
    /background-image:linear-gradient\(45deg,#ffffff,#000000\)/,
  );
  assert.match(rendered.html, /border-width:1px 2px 3px 4px/);
  assert.match(rendered.html, /border-radius:3px 6px 9px 12px/);
  assert.match(
    rendered.css,
    /animation:cl-picker-fade 300ms ease 100ms 1 both/,
  );
  assert.match(rendered.css, /prefers-reduced-motion:reduce/);
});

test("multi-stop gradients and looping animation render; Swiper ignores block animation", () => {
  const document = defaultTheme();
  document.templates.default.children.splice(
    1,
    0,
    {
      id: "gradient-block",
      type: "core/heading",
      settings: {
        text: "Colorful",
        backgroundGradient: {
          type: "linear",
          angle: 30,
          stops: [
            { color: "#ff0000", position: 0 },
            { color: "#00ff00", position: 40 },
            { color: "#0000ff", position: 100 },
          ],
        },
        animations: {
          Working: {
            preset: "scale",
            event: "hover",
            duration: 800,
            loop: true,
          },
        },
      },
    },
    {
      id: "swiper-block",
      type: "core/slider",
      settings: {
        animations: { In: { preset: "fade", event: "load", duration: 500 } },
      },
      children: [
        { id: "slide-one", type: "core/slide", settings: {}, children: [] },
        { id: "slide-two", type: "core/slide", settings: {}, children: [] },
      ],
    },
  );
  const rendered = renderTheme(validateDocument(document, true), {
    kind: "page",
    content: { title: "Test", body: "" },
    settings: { title: "Site", tagline: "" },
    allContent: [],
    media: [],
  });
  assert.match(
    rendered.html,
    /linear-gradient\(30deg,#ff0000 0%,#00ff00 40%,#0000ff 100%\)/,
  );
  assert.match(
    rendered.css,
    /\[data-block-id="gradient-block"\]:hover\{animation:cl-picker-scale 800ms ease 0ms infinite alternate/,
  );
  assert.doesNotMatch(
    rendered.css,
    /\[data-block-id="swiper-block"\][^{]*\{animation:/,
  );
});

test("picker units, fixed positioning, stacking, and transforms render safely", () => {
  const document = defaultTheme();
  const root = document.templates.default;
  root.settings = {
    ...root.settings,
    padding: { top: "2rem", right: "5%", bottom: 12, left: 0 },
    position: "fixed",
    offsets: { top: "3vh", right: 0 },
    zIndex: 25,
    transform: {
      translateX: "1rem",
      translateY: "-10px",
      rotate: 15,
      scaleX: 1.2,
      scaleY: 1,
    },
    gap: "1.5em",
    animations: {
      In: { preset: "fade", event: "load", duration: "0.5s", delay: "0.1s" },
    },
  };
  const rendered = renderTheme(validateDocument(document, true), {
    kind: "page",
    content: { title: "Test", body: "" },
    settings: { title: "Site", tagline: "" },
    allContent: [],
    media: [],
  });
  assert.match(rendered.body.style, /padding:2rem 5% 12px 0px/);
  assert.match(rendered.body.style, /position:fixed;top:3vh;right:0px/);
  assert.match(rendered.body.style, /z-index:25/);
  assert.match(
    rendered.body.style,
    /transform:translate\(1rem,-10px\) rotate\(15deg\) scale\(1.2,1\)/,
  );
  assert.match(rendered.body.style, /gap:1.5em/);
  assert.match(rendered.css, /cl-picker-fade 500ms ease 100ms/);
  root.settings.transform.translateX = "1rem);color:red";
  const unsafe = renderTheme(validateDocument(document, true), {
    kind: "page",
    content: { title: "Test", body: "" },
    settings: { title: "Site", tagline: "" },
    allContent: [],
    media: [],
  });
  assert.doesNotMatch(unsafe.body.style, /color:red/);
});

test("border sides render independent colors, styles, and widths", () => {
  const document = defaultTheme();
  document.templates.default.settings = {
    ...document.templates.default.settings,
    borderSides: { top: 2, right: "0.2rem", bottom: 0, left: 1 },
    borderColors: { top: "#ff0000", right: "#00ff00" },
    borderStyles: { top: "dashed", right: "dotted" },
  };
  const rendered = renderTheme(validateDocument(document, true), {
    kind: "page",
    content: { title: "Test", body: "" },
    settings: { title: "Site", tagline: "" },
    allContent: [],
    media: [],
  });
  assert.match(rendered.body.style, /border-width:2px 0.2rem 0px 1px/);
  assert.match(rendered.body.style, /border-style:dashed dotted solid solid/);
  assert.match(
    rendered.body.style,
    /border-color:#ff0000 #00ff00 currentColor currentColor/,
  );
});

test("auto sizing and side values compile without invalid CSS", () => {
  const document = defaultTheme();
  const root = document.templates.default;
  root.settings = {
    ...root.settings,
    maxWidth: "auto",
    minHeightEnabled: true,
    minHeight: "auto",
    margin: { top: "auto", right: "auto", bottom: 8, left: 0 },
    padding: { top: "auto", right: "auto", bottom: 8, left: 0 },
    borderSides: { top: "auto", right: 2, bottom: "auto", left: 0 },
    position: "relative",
    offsets: { top: "auto", right: "auto", bottom: 10 },
  };
  const options = {
    kind: "page",
    content: { title: "Test", body: "" },
    settings: { title: "Site", tagline: "" },
    allContent: [],
    media: [],
  };
  const rendered = renderTheme(validateDocument(document, true), options);
  assert.equal(rendered.body.blockId, root.id);
  assert.doesNotMatch(rendered.html, new RegExp(root.id));
  assert.match(rendered.body.style, /margin:auto auto 8px 0px/);
  assert.match(rendered.body.style, /padding:0px 0px 8px 0px/);
  assert.match(rendered.body.style, /border-width:0px 2px 0px 0px/);
  assert.doesNotMatch(
    rendered.body.style,
    /max-width:auto|top:auto|right:auto/,
  );
  assert.doesNotMatch(rendered.css, /min-height:0px/);

  root.settings.maxWidth = "60vw";
  root.settings.minHeight = "45vh";
  const sized = renderTheme(validateDocument(document, true), options);
  assert.match(sized.body.style, /max-width:60vw/);
  assert.match(sized.css, /min-height:45vh/);
});
