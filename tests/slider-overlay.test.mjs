import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultTheme,
  renderTheme,
  renderContentCanvas,
  themeMediaIds,
  validateDocument,
} from "../server/theme-engine.mjs";

const block = (id, type, settings = {}, children) => ({
  id,
  type,
  settings,
  ...(children ? { children } : {}),
});

test("Slider, Slide, and Overlay render nested content and Swiper controls", () => {
  const theme = defaultTheme();
  theme.templates.default.children.splice(
    1,
    0,
    block(
      "test-slider",
      "core/slider",
      {
        height: 480,
        slidesPerView: 2,
        spaceBetween: 18,
        speed: 600,
        loop: true,
        autoplay: true,
        autoplayDelay: 3200,
        navigation: true,
        pagination: true,
        ariaLabel: "Featured stories",
      },
      [
        block("test-slide-one", "core/slide", {}, [
          block("test-overlay-one", "core/overlay", {}, [
            block("test-caption", "core/heading", { text: "First slide" }),
          ]),
        ]),
        block("test-slide-two", "core/slide", {}, [
          block("test-body", "core/rich-text", { html: "<p>Second slide</p>" }),
        ]),
      ],
    ),
    block("test-model", "core/gltf", { alt: "Rotating model" }, [
      block("test-model-overlay", "core/overlay", {}, [
        block("test-model-label", "core/heading", { text: "Model label" }),
      ]),
    ]),
  );
  const rendered = renderTheme(validateDocument(theme, true), {
    kind: "page",
    content: { title: "Test", body: "" },
    settings: { title: "Site", tagline: "" },
    allContent: [],
    media: [],
  });
  assert.match(rendered.html, /class="swiper cl-swiper"/);
  assert.match(rendered.html, /data-swiper-per-view="2"/);
  assert.match(rendered.html, /data-swiper-autoplay="true"/);
  assert.match(rendered.html, /aria-label="Featured stories"/);
  assert.match(rendered.html, /swiper-button-next/);
  assert.match(rendered.html, /swiper-pagination/);
  assert.match(rendered.html, /swiper-slide/);
  assert.match(rendered.html, /cl-overlay-block/);
  assert.match(rendered.html, /First slide/);
  assert.match(rendered.html, /Second slide/);
  assert.match(rendered.html, /Model label/);
  assert.match(
    rendered.css,
    /cl-overlay-block\{position:absolute!important;inset:0;z-index:40/,
  );
});

test("structural blocks reject invalid parents", () => {
  for (const [type, children, message] of [
    ["core/slide", [], /Slide blocks can only/],
    ["core/overlay", [], /Overlay blocks can only/],
    [
      "core/slider",
      [block("test-heading", "core/heading", { text: "Wrong child" })],
      /Slider accepts Slide/,
    ],
  ]) {
    const theme = defaultTheme();
    theme.templates.default.children.splice(
      1,
      0,
      block("test-invalid", type, {}, children),
    );
    assert.throws(() => validateDocument(theme, true), message);
  }
});

test("slider minimum height grows the Swiper and respects breakpoints", () => {
  const theme = defaultTheme();
  theme.templates.default.children.splice(
    1,
    0,
    block(
      "sized-slider",
      "core/slider",
      {
        height: 420,
        minHeightEnabled: true,
        minHeight: "600px",
        minHeightByBreakpoint: { mobile: 320 },
      },
      [block("sized-slide", "core/slide", {}, [])],
    ),
  );
  const rendered = renderTheme(validateDocument(theme, true), {
    kind: "page",
    content: { title: "Test", body: "" },
    settings: { title: "Site", tagline: "" },
    allContent: [],
    media: [],
  });
  assert.match(rendered.html, /class="swiper cl-swiper"[^>]*height:420px/);
  assert.match(
    rendered.css,
    /\[data-block-id="sized-slider"\] > \.cl-swiper\{min-height:600px;\}/,
  );
  assert.match(
    rendered.css,
    /@media \(max-width:640px\)\{\[data-block-id="sized-slider"\] > \.cl-swiper\{min-height:320px;\}\}/,
  );
});

test("slide backgrounds render image, video, and model behind slide content", () => {
  const theme = defaultTheme();
  const slides = [
    block(
      "bg-image",
      "core/slide",
      {
        backgroundType: "image",
        backgroundMediaId: "image-one",
        backgroundSize: "contain",
        backgroundPositionX: "right",
        backgroundPositionY: "bottom",
        backgroundRepeat: "repeat-x",
      },
      [block("image-heading", "core/heading", { text: "Image caption" })],
    ),
    block("bg-video", "core/slide", {
      backgroundType: "video",
      backgroundMediaId: "video-one",
      backgroundLoop: false,
      backgroundSize: "cover",
      backgroundPositionX: "left",
    }),
    block("bg-model", "core/slide", {
      backgroundType: "model",
      backgroundMediaId: "model-one",
      backgroundAutoRotate: true,
    }),
  ];
  theme.templates.default.children.splice(
    1,
    0,
    block("media-slider", "core/slider", {}, slides),
  );
  const doc = validateDocument(theme, true);
  const media = [
    { id: "image-one", type: "image", url: "/api/media/image-one" },
    { id: "video-one", type: "video", url: "/api/media/video-one" },
    { id: "model-one", type: "model", url: "/api/media/model-one" },
  ];
  const ctx = {
    kind: "page",
    content: { title: "Test", body: "" },
    settings: { title: "Site", tagline: "" },
    allContent: [],
    media,
  };
  const rendered = renderTheme(doc, ctx);
  assert.deepEqual(
    themeMediaIds(doc).filter((id) => id.includes("-one")),
    ["image-one", "video-one", "model-one"],
  );
  assert.match(
    rendered.css,
    /background-image:url\("\/api\/media\/image-one"\)/,
  );
  assert.match(
    rendered.css,
    /background-position:right bottom;background-size:contain;background-repeat:repeat-x/,
  );
  assert.match(rendered.html, /cl-slide-background/);
  assert.match(rendered.html, /Image caption/);
  assert.match(
    rendered.html,
    /<video[^>]*src="\/api\/media\/video-one"[^>]*autoplay[^>]*muted/,
  );
  assert.doesNotMatch(rendered.html, /<video[^>]*loop/);
  assert.match(rendered.html, /data-model-url="\/api\/media\/model-one"/);
  assert.match(rendered.html, /data-auto-rotate="true"/);
  const content = {
    ...ctx,
    content: {
      ...ctx.content,
      details: {
        contentBlocks: [
          block("content-slider", "core/slider", {}, [slides[0]]),
        ],
      },
    },
  };
  const canvas = renderContentCanvas(doc, content, "blk_content-main");
  assert.match(canvas.html, /cl-slide-background/);
  assert.match(canvas.css, /background-repeat:repeat-x/);
});
