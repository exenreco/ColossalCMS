Cypress.Commands.addQuery("paragraphCanvas", function (frame, index = 0) {
  return () => {
    const paragraph = cy
      .state("document")
      .querySelector(frame)
      ?.contentDocument?.querySelectorAll("[data-paragraph-editor]")[index];
    return Cypress.$(paragraph ? [paragraph] : []);
  };
});
describe("Paragraph canvas authoring", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  const control = (name) =>
    cy.get(`.shared-editor button[aria-label="${name}"]`).filter(":visible");
  const paragraph = (frame = ".theme-live-preview", index = 0) =>
    cy.paragraphCanvas(frame, index).should("be.visible");
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
          body: { revision: body.revision, name: "Paragraph fixture" },
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
        return cy.request("/api/themes/" + themeId);
      })
      .then(({ body }) => {
        const document = body.draft || body.published;
        document.templates.home.children = [];
        document.parts.header.children = [];
        return cy.request({
          method: "PUT",
          url: "/api/themes/" + themeId + "/draft",
          headers,
          body: { revision: body.revision, document },
        });
      });
  });
  const openTheme = () => {
    cy.visit("/admin/themes/edit/" + themeId);
    paragraph().should("have.attr", "data-empty", "true");
    cy.get('.block-list-view [data-block-type="core/paragraph"]').should(
      "have.length",
      1,
    );
  };
  const canvasElement = (frame, selector) =>
    cy.get(frame).its("0.contentDocument.body").find(selector);

  it("searches blocks with slash, inserts with keyboard, and preserves text on cancel", () => {
    openTheme();
    paragraph().type("/");
    canvasElement(
      ".theme-live-preview",
      '.cl-slash-menu [data-slash-block="core/heading"]',
    ).should("be.visible");
    canvasElement(
      ".theme-live-preview",
      '.cl-slash-menu [data-slash-block="core/pagination"]',
    ).should("not.exist");
    paragraph().type("heading");
    canvasElement(
      ".theme-live-preview",
      '.cl-slash-menu [role="option"]',
    ).should("have.length", 1);
    paragraph()
      .trigger("keydown", { key: "ArrowDown" })
      .trigger("keydown", { key: "Enter" });
    canvasElement(".theme-live-preview", "[data-heading-editor]").should(
      "be.visible",
    );
    canvasElement(".theme-live-preview", ".cl-slash-menu").should("not.exist");
    control("Undo").click();
    paragraph()
      .should("contain", "/heading")
      .type("{selectall}/unfindableblock");
    canvasElement(".theme-live-preview", ".cl-slash-menu").should(
      "contain",
      "No matching blocks",
    );
    paragraph().trigger("keydown", { key: "Escape" }).type(" literal");
    canvasElement(".theme-live-preview", ".cl-slash-menu").should("not.exist");
    paragraph().should("contain", "/unfindableblock literal");
  });

  for (const kind of ["post", "page"])
    it(`inserts a searched block after existing text in a ${kind}`, () => {
      cy.visit(`/admin/${kind}s/new`);
      cy.get('[aria-label="Title"]').type(`Slash ${kind}`);
      paragraph(".content-live-preview").type("Keep this text /image");
      canvasElement(
        ".content-live-preview",
        '.cl-slash-menu [data-slash-block="core/image"]',
      ).click();
      paragraph(".content-live-preview")
        .should("contain", "Keep this text")
        .and("not.contain", "/image");
      canvasElement(
        ".content-live-preview",
        '[aria-label="Image placeholder"]',
      ).should("exist");
      control("Save draft").click();
      cy.contains("All changes saved").should("be.visible");
      cy.request("/api/admin/state").then(({ body }) => {
        const entry = body.content.find(
          (item) => item.title === `Slash ${kind}`,
        );
        expect(entry.details.contentBlocks.map((block) => block.type)).deep.eq([
          "core/paragraph",
          "core/image",
        ]);
        expect(entry.details.contentBlocks[0].settings.html).not.contain(
          "/image",
        );
      });
    });

  it("seeds an empty template, keeps canvas typing focused, and saves shared Typography settings", () => {
    openTheme();
    let original;
    paragraph().then((elements) => {
      original = elements[0];
    });
    paragraph().type("Written directly on the canvas.", { delay: 45 });
    paragraph()
      .should((elements) => {
        expect(elements[0]).eq(original);
        expect(elements[0].ownerDocument.activeElement).eq(elements[0]);
      })
      .type("{selectall}");
    cy.get('.contextual-block-toolbar [aria-label="Bold"]').click();
    paragraph().find("strong").should("contain", "Written directly");
    cy.get("cl-typography-picker .cl-picker-trigger").click();
    cy.get("cl-typography-picker .cl-picker-field select")
      .first()
      .select("Georgia");
    cy.get('cl-typography-picker input[aria-label="Font size slider"]')
      .invoke("val", 24)
      .trigger("input");
    cy.get("cl-typography-picker .cl-picker-popover:popover-open").trigger(
      "keydown",
      { key: "Escape" },
    );
    cy.get(".theme-live-preview").should((frames) => {
      const doc = frames[0].contentDocument;
      const block = doc?.querySelector(
        "[data-paragraph-editor]",
      )?.parentElement;
      expect(block, "paragraph wrapper").to.exist;
      expect(doc.defaultView.getComputedStyle(block).fontSize).eq("24px");
    });
    control("Save draft").click();
    cy.contains("Theme draft saved.").should("exist");
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      const blocks = body.draft.templates.home.children;
      expect(blocks).to.have.length(1);
      expect(blocks[0].type).eq("core/paragraph");
      expect(blocks[0].settings.html).contain("<strong>");
      expect(blocks[0].settings.fontFamily).eq("Georgia");
      expect(blocks[0].settings.fontSize).eq(24);
    });
    cy.reload();
    paragraph().should("contain", "Written directly");
    cy.get('.block-list-view [data-block-type="core/paragraph"]').should(
      "have.length",
      1,
    );
    control("Blocks").click();
    cy.get('[data-library-block="core/paragraph"]')
      .should("be.visible")
      .click();
    control("List view").click();
    cy.get('.block-list-view [data-block-type="core/paragraph"]').should(
      "have.length",
      2,
    );
  });

  it("seeds an empty shared part and restores a starting paragraph after the last block is deleted", () => {
    openTheme();
    control("Choose template").click();
    cy.get('.editor-template-grid button[data-part="header"]').click();
    paragraph().type("Shared header paragraph");
    control("Save draft").click();
    cy.contains("Theme draft saved.").should("exist");
    cy.request("/api/themes/" + themeId).then(({ body }) =>
      expect(body.draft.parts.header.children[0].settings.html).eq(
        "Shared header paragraph",
      ),
    );
    cy.get('.editor-sidebar[aria-label="Editor sidebar"]').then((sidebar) => {
      if (sidebar.attr("aria-hidden") === "true") control("List view").click();
    });
    cy.get(
      '.block-list-view [data-block-type="core/paragraph"] > .theme-tree-row',
    )
      .should("be.visible")
      .trigger("keydown", { key: "Delete" });
    paragraph().should("have.attr", "data-empty", "true");
    cy.get('.block-list-view [data-block-type="core/paragraph"]').should(
      "have.length",
      1,
    );
    control("Undo").click();
    paragraph().should("contain", "Shared header paragraph");
  });

  it("splits paragraphs with Enter, keeps a line break with Shift+Enter, and undoes typing without losing the canvas", () => {
    openTheme();
    paragraph().type("First paragraph{enter}");
    paragraph(".theme-live-preview", 1)
      .should((elements) =>
        expect(elements[0].ownerDocument.activeElement).eq(elements[0]),
      )
      .type("Second paragraph");
    paragraph(".theme-live-preview", 1)
      .trigger("keydown", { key: "Enter", shiftKey: true })
      .type("Next line");
    paragraph(".theme-live-preview", 1).find("br").should("have.length", 1);
    paragraph(".theme-live-preview", 1).trigger("keydown", {
      key: "z",
      ctrlKey: true,
    });
    paragraph(".theme-live-preview", 1)
      .should("have.attr", "data-empty", "true")
      .should((elements) =>
        expect(elements[0].ownerDocument.activeElement).eq(elements[0]),
      );
    paragraph(".theme-live-preview", 1).trigger("keydown", {
      key: "z",
      ctrlKey: true,
    });
    paragraph()
      .should("contain", "First paragraph")
      .should((elements) =>
        expect(elements[0].ownerDocument.activeElement).eq(elements[0]),
      );
    cy.get(".theme-live-preview")
      .its("0.contentDocument.body")
      .find("[data-paragraph-editor]")
      .should("have.length", 1);
  });

  for (const kind of ["post", "page"])
    it(`starts a new ${kind} with a paragraph and persists direct canvas edits`, () => {
      cy.visit(`/admin/${kind}s/new`);
      cy.get('[aria-label="Title"]').type(`Paragraph ${kind}`);
      paragraph(".content-live-preview")
        .should("have.attr", "data-empty", "true")
        .type(`Inline ${kind} content`, { delay: 45 });
      cy.get("cl-typography-picker .cl-picker-trigger").click();
      cy.get("cl-typography-picker .cl-picker-field select")
        .first()
        .select("Georgia");
      cy.get("cl-typography-picker .cl-picker-popover:popover-open").trigger(
        "keydown",
        { key: "Escape" },
      );
      control("Save draft").click();
      cy.contains("All changes saved").should("be.visible");
      cy.request("/api/admin/state").then(({ body }) => {
        const entry = body.content.find(
          (item) => item.title === `Paragraph ${kind}`,
        );
        expect(entry.details.contentBlocks).to.have.length(1);
        expect(entry.details.contentBlocks[0].type).eq("core/paragraph");
        expect(entry.details.contentBlocks[0].settings.html).eq(
          `Inline ${kind} content`,
        );
        expect(entry.details.contentBlocks[0].settings.fontFamily).eq(
          "Georgia",
        );
        cy.visit(`/admin/${kind}s/edit/${entry.id}`);
      });
      paragraph(".content-live-preview").should(
        "contain",
        `Inline ${kind} content`,
      );
    });
});
