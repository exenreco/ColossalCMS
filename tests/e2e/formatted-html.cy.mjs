Cypress.Commands.addQuery(
  "htmlCanvasSource",
  function (frame = ".theme-live-preview") {
    return () => {
      const input = cy
        .state("document")
        .querySelector(frame)
        ?.contentDocument?.querySelector("[data-html-editor]:not(:disabled)");
      return Cypress.$(input ? [input] : []);
    };
  },
);
describe("Formatted HTML canvas editor", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  const control = (name) =>
    cy.get(`.shared-editor button[aria-label="${name}"]`).filter(":visible");
  const source = "<h2>Original HTML</h2>\n<p>Already saved in this theme.</p>";
  const changed =
    "<h2>Edited on the canvas</h2>\n<ul><li>HTML stays structured</li></ul>";
  let themeId;
  beforeEach(() => {
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      headers,
      body: {},
      failOnStatusCode: false,
    });
    cy.request({
      method: "PUT",
      url: "/api/admin/editor/preferences",
      headers,
      body: { colorMode: "dark", walkthroughVersion: 1 },
    });
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/" + body.id + "/clone",
          headers,
          body: { revision: body.revision, name: "Formatted HTML fixture" },
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
        return cy.request("/api/themes/" + themeId);
      })
      .then(({ body }) => {
        const document = body.draft || body.published;
        document.templates.home.children = [
          {
            id: "blk_legacy_html",
            type: "core/rich-text",
            settings: { html: source },
            editor: { label: "Rich text" },
          },
        ];
        document.parts.header.children = [
          {
            id: "blk_shared_html",
            type: "core/rich-text",
            settings: { html: "<p>Shared source</p>" },
          },
        ];
        return cy.request({
          method: "PUT",
          url: "/api/themes/" + themeId + "/draft",
          headers,
          body: { revision: body.revision, document },
        });
      });
  });
  const open = () => {
    cy.visit("/admin/themes/edit/" + themeId);
    cy.htmlCanvasSource().should("have.value", source);
  };
  it("renames existing blocks, edits highlighted source without replacing the focused canvas, and saves normal public HTML", () => {
    open();
    cy.get('.block-list-view [data-block-type="core/rich-text"]')
      .should("contain", "Formatted HTML")
      .and("not.contain", "Rich text");
    let original;
    cy.htmlCanvasSource().then((inputs) => {
      original = inputs[0];
    });
    cy.htmlCanvasSource()
      .clear()
      .type(changed, { parseSpecialCharSequences: false, delay: 35 });
    cy.htmlCanvasSource().should((inputs) => {
      expect(inputs[0]).eq(original);
      expect(inputs[0].ownerDocument.activeElement).eq(inputs[0]);
      expect(
        inputs[0].ownerDocument.querySelector(
          ".cl-html-editor-highlight .cl-html-tag",
        ),
      ).not.eq(null);
      expect(
        inputs[0].ownerDocument.querySelector(".cl-html-editor-lines")
          .textContent,
      ).eq("1\n2");
    });
    control("Save draft").click();
    cy.contains("Theme draft saved.").should("exist");
    cy.request("/api/themes/" + themeId)
      .then(({ body }) => {
        const node = body.draft.templates.home.children[0];
        expect(node.id).eq("blk_legacy_html");
        expect(node.settings.html).eq(changed);
        return cy.request({
          method: "POST",
          url: "/api/themes/" + themeId + "/render",
          headers,
          body: { document: body.draft, templateId: "home" },
        });
      })
      .then(({ body }) => {
        expect(body.html).contain(changed);
        expect(body.html).not.contain("data-html-editor");
        expect(body.html).not.contain("cl-html-editor");
      });
    cy.reload();
    cy.htmlCanvasSource().should("have.value", changed);
    control("Blocks").click();
    cy.get('[data-library-block="core/rich-text"]').should(
      "contain",
      "Formatted HTML",
    );
  });
  it("indents code, uses document undo/redo, and follows light and dark editor modes", () => {
    open();
    cy.htmlCanvasSource()
      .type("{selectall}")
      .trigger("keydown", { key: "Tab" });
    cy.htmlCanvasSource().should(
      "have.value",
      source
        .split("\n")
        .map((line) => "  " + line)
        .join("\n"),
    );
    cy.htmlCanvasSource().trigger("keydown", { key: "z", ctrlKey: true });
    cy.htmlCanvasSource()
      .should("have.value", source)
      .should((inputs) =>
        expect(inputs[0].ownerDocument.activeElement).eq(inputs[0]),
      );
    cy.htmlCanvasSource().trigger("keydown", {
      key: "z",
      ctrlKey: true,
      shiftKey: true,
    });
    cy.htmlCanvasSource().trigger("keydown", { key: "Tab", shiftKey: true });
    cy.htmlCanvasSource().should("have.value", source);
    cy.get(".theme-live-preview").should((frames) => {
      const doc = frames[0].contentDocument;
      expect(
        doc.defaultView.getComputedStyle(doc.querySelector(".cl-html-editor"))
          .backgroundColor,
      ).eq("rgb(36, 37, 40)");
    });
    control("Switch to light mode").click();
    cy.get(".theme-live-preview").should((frames) => {
      const doc = frames[0].contentDocument;
      expect(
        doc.defaultView.getComputedStyle(doc.querySelector(".cl-html-editor"))
          .backgroundColor,
      ).eq("rgb(255, 255, 255)");
    });
  });
  it("edits a shared part source and does not let a previous template accept those keystrokes", () => {
    open();
    control("Choose template").click();
    cy.get('.editor-template-grid button[data-part="header"]').click();
    cy.htmlCanvasSource()
      .should("have.value", "<p>Shared source</p>")
      .clear()
      .type("<p>Shared HTML edited</p>", { parseSpecialCharSequences: false });
    control("Save draft").click();
    cy.contains("Theme draft saved.").should("exist");
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      expect(body.draft.parts.header.children[0].settings.html).eq(
        "<p>Shared HTML edited</p>",
      );
      expect(body.draft.templates.home.children[0].settings.html).eq(source);
    });
  });
  for (const kind of ["post", "page"])
    it(`edits and persists a ${kind} Formatted HTML block directly on its canvas`, () => {
      cy.visit(`/admin/${kind}s/new`);
      cy.get('[aria-label="Title"]').type(`Formatted HTML ${kind}`);
      control("Blocks").click();
      cy.get('[data-library-block="core/rich-text"]').click();
      cy.htmlCanvasSource(".content-live-preview")
        .should("be.visible")
        .clear()
        .type(changed, { parseSpecialCharSequences: false });
      control("Save draft").click();
      cy.contains("All changes saved").should("be.visible");
      cy.request("/api/admin/state").then(({ body }) => {
        const entry = body.content.find(
          (item) => item.title === `Formatted HTML ${kind}`,
        );
        const node = entry.details.contentBlocks.find(
          (item) => item.type === "core/rich-text",
        );
        expect(node.settings.html).eq(changed);
        cy.visit(`/admin/${kind}s/edit/${entry.id}`);
      });
      cy.htmlCanvasSource(".content-live-preview").should(
        "have.value",
        changed,
      );
    });
});
