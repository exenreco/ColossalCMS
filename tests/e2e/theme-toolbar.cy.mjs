describe("Shared theme toolbar and sidebar", () => {
  let themeId;
  const headers = { Origin: "http://127.0.0.1:4201" };
  const control = (name) =>
    cy.get(`.shared-editor button[aria-label="${name}"]`).filter(":visible");
  const inspector = () => {
    cy.get('[aria-label="Toggle Inspector"]').then((button) => {
      if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
    });
  };
  beforeEach(() => {
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      body: {},
      headers,
      failOnStatusCode: false,
    });
    cy.request({
      method: "PUT",
      url: "/api/admin/editor/preferences",
      headers,
      body: { walkthroughVersion: 1, colorMode: "dark" },
    });
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/com.colossal.theme.default/clone",
          headers,
          body: { revision: body.revision, name: "Toolbar test" },
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
        cy.visit("/admin/themes/edit/" + themeId);
      });
    cy.get(".theme-live-preview")
      .should("be.visible")
      .should((frame) =>
        expect(frame[0].contentDocument.querySelector(".theme-root")).not.eq(
          null,
        ),
      );
  });
  it("keeps a shared part open after publishing through the new settings menu", () => {
    control("Choose template").click();
    cy.get('.editor-template-grid button[data-part="header"]').click();
    cy.contains("Editing shared header").should("be.visible");
    control("Blocks").click();
    cy.get('[data-library-block="core/heading"]').first().click();
    inspector();
    cy.get(".theme-inspector")
      .contains("label", "Text")
      .find("input")
      .clear()
      .type("Published shared header");
    control("Editor settings").click();
    cy.get('dialog[aria-label="Editor settings"]:popover-open')
      .contains("button", "Publish changes")
      .click();
    cy.get('dialog[aria-label="Publish changes?"]')
      .should("be.visible")
      .contains("button", "Publish changes")
      .click();
    cy.contains("Theme published").should("exist");
    cy.contains("Editing shared header").should("be.visible");
    cy.get(".theme-editor").should("have.attr", "data-template-id", "home");
    control("Outline").click();
    cy.get("#block-list-drawer").should("contain", "Published shared header");
    cy.get(".theme-live-preview").should("be.visible");
  });
  it("uses a themed text prompt to clone and a cancelable modal for unsaved navigation", () => {
    control("Editor settings").click();
    cy.get('dialog[aria-label="Editor settings"]:popover-open')
      .contains("button", "Save as new theme")
      .click();
    cy.get('dialog[aria-label="Save as new theme"]').should("be.visible");
    cy.get('dialog[aria-label="Save as new theme"] input')
      .clear()
      .type("Shared modal clone");
    cy.get('dialog[aria-label="Save as new theme"]')
      .contains("button", "Create")
      .click();
    cy.get(".editor-breadcrumb").should("contain", "Shared modal clone");
    cy.location("pathname").should("not.contain", themeId);
    control("Blocks").click();
    cy.get('[data-library-block="core/spacer"]').first().click();
    control("Back to workspace").click();
    cy.get('dialog[aria-label="Leave unsaved changes?"]')
      .should("be.visible")
      .contains("button", "Keep editing")
      .click();
    cy.get(".theme-live-preview").should("be.visible");
    control("Back to workspace").click();
    cy.get('dialog[aria-label="Leave unsaved changes?"]')
      .contains("button", "Discard changes")
      .click();
    cy.location("pathname").should("eq", "/admin/themes");
  });
  it("keeps the rail and canvas usable when the sidebar overlays a narrow viewport", () => {
    cy.viewport(640, 844);
    control("Blocks").click();
    cy.get(".editor-sidebar").should("be.visible");
    cy.get(".theme-live-preview").should("be.visible");
    cy.get(".editor-sidebar-scrim").click("right");
    cy.get(".shared-editor").should("have.class", "sidebar-closed");
    control("Outline").click();
    cy.get(".theme-outline").should("be.visible");
    cy.get("body").trigger("keydown", { key: "Escape", force: true });
    cy.get(".shared-editor").should("have.class", "sidebar-closed");
    cy.window().then((win) =>
      expect(win.document.documentElement.scrollWidth).at.most(win.innerWidth),
    );
  });
  it("keeps undo, redo and editor shortcuts working without stealing input shortcuts", () => {
    control("Undo").should("be.disabled");
    control("Redo").should("be.disabled");
    control("Blocks").click();
    cy.get('[data-library-block="core/spacer"]').first().click();
    control("Undo").click();
    control("Redo").should("not.be.disabled").click();
    cy.get("body").trigger("keydown", {
      key: "O",
      ctrlKey: true,
      shiftKey: true,
      force: true,
    });
    cy.get(".theme-outline").should("be.visible");
    cy.get(".theme-live-preview").should("be.visible");
    cy.get("body").trigger("keydown", { key: "1", metaKey: true, force: true });
    cy.get(".theme-live-preview").should("have.css", "width", "1200px");
    cy.get("body").trigger("keydown", { key: "b", ctrlKey: true, force: true });
    cy.get(".block-library__search")
      .type("Heading")
      .trigger("keydown", { key: "3", ctrlKey: true });
    cy.get(".theme-live-preview").should("have.css", "width", "1200px");
    cy.get("body").trigger("keydown", { key: "k", ctrlKey: true, force: true });
    cy.get('dialog[aria-label="Choose template"]').should("be.visible");
    cy.get(
      'dialog[aria-label="Choose template"] input[aria-label="Search templates"]',
    ).should("have.focus");
  });
});
