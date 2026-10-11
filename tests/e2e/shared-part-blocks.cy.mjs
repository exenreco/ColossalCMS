Cypress.Commands.addQuery(
  "sharedCanvas",
  function (selector, frame = ".theme-live-preview") {
    return () =>
      Cypress.$(
        cy
          .state("document")
          .querySelector(frame)
          ?.contentDocument?.querySelectorAll(selector) || [],
      );
  },
);

describe("Shared Parts block library", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  const core = "com.colossal.theme.default";
  const control = (name) =>
    cy.get(`.shared-editor button[aria-label="${name}"]`).filter(":visible");
  const block = (id, type, settings = {}, children) => ({
    id,
    type,
    settings,
    ...(children ? { children } : {}),
  });
  const row = (type) => cy.get(`[data-block-type="${type}"] > .theme-tree-row`);
  const menu = (text) =>
    cy
      .get(".outline-context-menu:popover-open")
      .contains('[role="menuitem"]', text);
  let themeId;
  let document;
  before(() => {
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
      body: { walkthroughVersion: 1, colorMode: "dark" },
    });
  });
  beforeEach(() => {
    cy.intercept("PUT", "/api/themes/*/draft").as("draft");
    cy.request("/api/themes/" + core)
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/" + core + "/clone",
          headers,
          body: { revision: body.revision, name: "Shared Parts browser test" },
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
        return cy.request("/api/themes/" + themeId);
      })
      .then(({ body }) => {
        document = body.published;
        document.templates.home.children = [
          block(
            "blk_starting_group",
            "core/container",
            { padding: { top: 20, bottom: 20 } },
            [
              block("blk_starting_heading", "core/heading", {
                text: "Existing layout",
              }),
            ],
          ),
        ];
        document.parts.header.children = [
          block("blk_shared_heading", "core/heading", {
            text: "Shared header message",
          }),
        ];
        document.parts.sidebar.children = [
          block("blk_sidebar_heading", "core/heading", {
            text: "Shared sidebar message",
          }),
        ];
        return cy.request({
          method: "PUT",
          url: "/api/themes/" + themeId + "/draft",
          headers,
          body: { revision: body.revision, document },
        });
      })
      .then(() => cy.visit("/admin/themes/edit/" + themeId));
    cy.sharedCanvas('[data-block-id="blk_starting_group"]').should("exist");
  });
  it("lists every part and selects inserted shared content from Canvas with independent appearance controls", () => {
    control("Blocks").click();
    cy.contains(".block-library__category-name", "Shared Parts").should(
      "exist",
    );
    for (const name of ["header", "footer", "sidebar", "content"])
      cy.get(`[data-library-block="theme/part-${name}"]`)
        .should("be.visible")
        .and("not.be.disabled");
    cy.get('[data-library-block="theme/part-header"]').click();
    cy.sharedCanvas(".theme-part-header").should("have.length", 1);
    cy.sharedCanvas(".theme-part-header h2").click();
    cy.get(".theme-inspector").should("contain", "Header");
    cy.get("cl-contextual-block-toolbar").should((toolbar) => {
      const rect = toolbar[0].getBoundingClientRect();
      expect(rect.left).to.be.at.least(0);
      expect(rect.right).to.be.at.most(
        toolbar[0].ownerDocument.defaultView.innerWidth,
      );
    });
    cy.get(".theme-inspector")
      .contains("button", "Edit shared content")
      .should("be.visible");
    cy.get('.contextual-block-toolbar [aria-label="Duplicate block"]').click();
    cy.sharedCanvas(".theme-part-header").should("have.length", 2);
    control("Save draft").click();
    cy.wait("@draft");
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      const refs = body.draft.templates.home.children.filter(
        (b) => b.type === "theme/part-header",
      );
      expect(refs).to.have.length(2);
      expect(refs[0].id).not.eq(refs[1].id);
      expect(body.draft.parts.header.children[0].settings.text).eq(
        "Shared header message",
      );
    });
  });
  it("copies, pastes, cuts and removes shared instances through List view and undo", () => {
    control("Blocks").click();
    cy.get('[data-library-block="theme/part-header"]').click();
    control("List view").click();
    row("theme/part-header").rightclick();
    menu("Copy").click();
    row("core/container").first().rightclick();
    menu("Paste inside").click();
    row("theme/part-header").should("have.length", 2);
    row("theme/part-header").last().rightclick();
    menu("Cut").click();
    row("theme/part-header").should("have.length", 1);
    control("Undo").click();
    row("theme/part-header").should("have.length", 2);
    row("theme/part-header").last().rightclick();
    menu("Delete").click();
    row("theme/part-header").should("have.length", 1);
    control("Save draft").click();
    cy.wait("@draft");
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      expect(body.draft.parts.header.children[0].settings.text).eq(
        "Shared header message",
      );
    });
  });
  it("edits the shared source, prevents self-reference, and updates all uses after returning to Home", () => {
    control("Blocks").click();
    cy.get('[data-library-block="theme/part-header"]').click();
    control("List view").click();
    row("theme/part-header").click();
    cy.get('[aria-label="Duplicate block"]').click();
    cy.get('[aria-label="Edit shared content"]').click();
    cy.contains("Editing shared header").should("be.visible");
    control("Blocks").click();
    cy.get('[data-library-block="theme/part-header"]').should("be.disabled");
    cy.get('[data-library-block="theme/part-footer"]').should(
      "not.be.disabled",
    );
    cy.sharedCanvas('[data-inline-text-editor="blk_shared_heading"]')
      .clear()
      .type("Updated shared message")
      .trigger("blur");
    cy.get(".theme-part-banner").contains("button", "Template").click();
    cy.sharedCanvas(".theme-part-header")
      .should("have.length", 2)
      .each((part) => expect(part.text()).to.contain("Updated shared message"));
    control("Save draft").click();
    cy.wait("@draft");
    cy.reload();
    cy.sharedCanvas(".theme-part-header")
      .should("have.length", 2)
      .each((part) => expect(part.text()).to.contain("Updated shared message"));
  });
  it("drags a new shared block from Blocks into an occupied layout", () => {
    control("Blocks").click();
    cy.get('[data-library-block="theme/part-sidebar"]').trigger("pointerdown", {
      pointerId: 71,
      pointerType: "mouse",
      button: 0,
      buttons: 1,
      clientX: 120,
      clientY: 300,
    });
    cy.get(".theme-live-preview").then((frames) => {
      const frame = frames[0],
        doc = frame.ownerDocument,
        offset = frame.getBoundingClientRect(),
        rect = frame.contentDocument
          .querySelector('[data-block-id="blk_starting_group"]')
          .getBoundingClientRect();
      const point = {
        clientX: offset.left + rect.left + rect.width / 2,
        clientY: offset.top + rect.bottom - 4,
      };
      for (const name of ["pointermove", "pointerup"])
        doc.dispatchEvent(
          new doc.defaultView.PointerEvent(name, {
            bubbles: true,
            cancelable: true,
            pointerId: 71,
            pointerType: "mouse",
            button: 0,
            buttons: name === "pointerup" ? 0 : 1,
            ...point,
          }),
        );
    });
    cy.sharedCanvas(
      '[data-block-id="blk_starting_group"] .theme-part-sidebar',
    ).should("contain", "Shared sidebar message");
    cy.get(".theme-editor-viewport").should("not.have.class", "is-dragging");
  });
  it("allows explicit shared blocks in entry content and disables recursive Content parts", () => {
    cy.request("/api/themes/" + themeId).then(({ body }) =>
      cy.request({
        method: "POST",
        url: "/api/themes/" + themeId + "/publish",
        headers,
        body: { revision: body.revision },
      }),
    );
    cy.request("/api/themes/" + themeId).then(({ body }) =>
      cy.request({
        method: "POST",
        url: "/api/themes/" + themeId + "/activate",
        headers,
        body: { revision: body.revision },
      }),
    );
    cy.visit("/admin/pages/new");
    cy.get('input[aria-label="Title"]').type("Explicit shared content page");
    control("Blocks").click();
    cy.get('[data-library-block="theme/part-content"]').should("be.disabled");
    cy.get('[data-library-block="theme/part-sidebar"]')
      .should("not.be.disabled")
      .click();
    cy.sharedCanvas(".theme-part-sidebar", ".content-live-preview").should(
      "contain",
      "Shared sidebar message",
    );
    cy.sharedCanvas(".theme-part-header", ".content-live-preview").should(
      "not.exist",
    );
    control("Save draft").click();
    cy.contains("All changes saved").should("exist");
    cy.request("/api/admin/state").then(({ body }) => {
      const page = body.content.find(
        (c) => c.title === "Explicit shared content page",
      );
      expect(
        page.details.contentBlocks.some((b) => b.type === "theme/part-sidebar"),
      ).eq(true);
    });
  });
});
