Cypress.Commands.addQuery(
  "headingCanvas",
  function (frame = ".theme-live-preview") {
    return () => {
      const heading = cy
        .state("document")
        .querySelector(frame)
        ?.contentDocument?.querySelector("[data-heading-editor]");
      return Cypress.$(heading ? [heading] : []);
    };
  },
);
describe("Heading canvas authoring", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  const control = (name) =>
    cy.get(`.shared-editor button[aria-label="${name}"]`).filter(":visible");
  let themeId;
  beforeEach(() => {
    cy.intercept("PUT", "/api/themes/*/draft").as("themeDraft");
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
          body: { revision: body.revision, name: "Heading fixture" },
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
            id: "blk_heading_test",
            type: "core/heading",
            settings: { text: "Existing heading", level: "h3" },
          },
        ];
        document.parts.header.children = [
          {
            id: "blk_shared_heading",
            type: "core/heading",
            settings: { text: "Shared heading", level: "h2" },
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
    cy.headingCanvas()
      .should("contain.text", "Existing heading")
      .and("match", "h3");
  };
  it("edits headings in place, synchronizes Inspector, formats selections, and saves their level and Typography", () => {
    open();
    let original;
    cy.headingCanvas().then((elements) => {
      original = elements[0];
    });
    cy.headingCanvas().type("{selectall}Typed on the canvas", { delay: 45 });
    cy.headingCanvas().should((elements) => {
      expect(elements[0]).eq(original);
      expect(elements[0].ownerDocument.activeElement).eq(elements[0]);
    });
    cy.get(".theme-inspector")
      .contains("label", "Text")
      .find("input")
      .should("have.value", "Typed on the canvas");
    cy.headingCanvas().type("{selectall}");
    cy.get('.contextual-block-toolbar [aria-label="Italic"]').click();
    cy.headingCanvas().find("em").should("contain", "Typed on the canvas");
    cy.get(
      '.contextual-block-toolbar select[aria-label="Heading level"]',
    ).select("h4");
    cy.headingCanvas().should("match", "h4");
    cy.get("cl-typography-picker .cl-picker-trigger").click();
    cy.get("cl-typography-picker .cl-picker-field select")
      .first()
      .select("Georgia");
    cy.get("cl-typography-picker .cl-picker-popover:popover-open").trigger(
      "keydown",
      { key: "Escape" },
    );
    control("Save draft").click();
    cy.wait("@themeDraft");
    cy.contains("Theme draft saved.").should("exist");
    cy.request("/api/themes/" + themeId)
      .then(({ body }) => {
        const node = body.draft.templates.home.children[0];
        expect(node.settings.html).contain("<em>");
        expect(node.settings.text).eq("Typed on the canvas");
        expect(node.settings.level).eq("h4");
        expect(node.settings.fontFamily).eq("Georgia");
        return cy.request({
          method: "POST",
          url: "/api/themes/" + themeId + "/render",
          headers,
          body: { document: body.draft, templateId: "home" },
        });
      })
      .then(({ body }) => {
        expect(body.html).contain("<h4><em>Typed on the canvas</em></h4>");
        expect(body.html).not.contain("contenteditable");
        expect(body.html).not.contain("data-heading-editor");
      });
    cy.reload();
    cy.headingCanvas()
      .should("contain.text", "Typed on the canvas")
      .and("match", "h4");
  });
  it("supports heading undo and redo, Shift+Enter line breaks, and Enter starting a paragraph", () => {
    open();
    cy.headingCanvas().type("{selectall}Updated heading");
    cy.headingCanvas().trigger("keydown", { key: "z", ctrlKey: true });
    cy.headingCanvas()
      .should("contain.text", "Existing heading")
      .should((elements) =>
        expect(elements[0].ownerDocument.activeElement).eq(elements[0]),
      );
    cy.headingCanvas().trigger("keydown", {
      key: "z",
      ctrlKey: true,
      shiftKey: true,
    });
    cy.headingCanvas().should("contain.text", "Updated heading");
    cy.headingCanvas()
      .type("{end}")
      .trigger("keydown", { key: "Enter", shiftKey: true })
      .type("Second line");
    cy.headingCanvas().find("br").should("have.length", 1);
    cy.headingCanvas().type("{end}{enter}");
    cy.get(".theme-live-preview").should((frames) => {
      const doc = frames[0].contentDocument;
      const paragraph = doc.querySelector("[data-paragraph-editor]");
      expect(paragraph).not.eq(null);
      expect(doc.activeElement).eq(paragraph);
      expect(doc.querySelector("[data-heading-editor]").textContent).contain(
        "Second line",
      );
    });
    cy.get(".block-list-view").should("not.exist");
    control("List view").click();
    cy.get('.block-list-view [data-block-type="core/heading"]').should(
      "have.length",
      1,
    );
    cy.get('.block-list-view [data-block-type="core/paragraph"]').should(
      "have.length",
      1,
    );
  });
  it("edits shared-part headings and persists an empty heading without restoring its original text", () => {
    open();
    control("Choose template").click();
    cy.get('.editor-template-grid button[data-part="header"]').click();
    cy.headingCanvas()
      .should("contain.text", "Shared heading")
      .type("{selectall}Shared edited heading");
    control("Save draft").click();
    cy.wait("@themeDraft");
    cy.contains("Theme draft saved.").should("exist");
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      expect(body.draft.parts.header.children[0].settings.text).eq(
        "Shared edited heading",
      );
      expect(body.draft.templates.home.children[0].settings.text).eq(
        "Existing heading",
      );
    });
    cy.headingCanvas()
      .type("{selectall}{backspace}")
      .should("have.attr", "data-empty", "true");
    control("Save draft").click();
    cy.wait("@themeDraft");
    cy.contains("Theme draft saved.").should("exist");
    cy.request("/api/themes/" + themeId)
      .then(({ body }) => {
        expect(body.draft.parts.header.children[0].settings.text).eq("");
        return cy.request({
          method: "POST",
          url: "/api/themes/" + themeId + "/render",
          headers,
          body: { document: body.draft, templateId: "home", part: "header" },
        });
      })
      .then(({ body }) => {
        expect(body.html).not.contain("Shared edited heading");
        expect(body.html).not.contain("Write a heading");
      });
  });
  for (const kind of ["post", "page"])
    it(`edits a ${kind} heading directly and persists it once in the content text`, () => {
      cy.visit(`/admin/${kind}s/new`);
      cy.get('[aria-label="Title"]').type(`Inline heading ${kind}`);
      control("Blocks").click();
      cy.get('[data-library-block="core/heading"]').click();
      cy.headingCanvas(".content-live-preview")
        .should("be.visible")
        .type(`{selectall}Editable ${kind} heading`, { delay: 45 });
      control("Save draft").click();
      cy.contains("All changes saved").should("be.visible");
      cy.request("/api/admin/state").then(({ body }) => {
        const entry = body.content.find(
          (item) => item.title === `Inline heading ${kind}`,
        );
        const heading = entry.details.contentBlocks.find(
          (item) => item.type === "core/heading",
        );
        expect(heading.settings.text).eq(`Editable ${kind} heading`);
        expect(heading.settings.html).eq(`Editable ${kind} heading`);
        expect(entry.body.trim()).eq(`Editable ${kind} heading`);
        cy.visit(`/admin/${kind}s/edit/${entry.id}`);
      });
      cy.headingCanvas(".content-live-preview").should(
        "contain.text",
        `Editable ${kind} heading`,
      );
    });
});
