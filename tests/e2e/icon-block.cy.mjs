import { setAdminMode } from "./helpers/admin-mode.mjs";
Cypress.Commands.addQuery(
  "iconCanvas",
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

describe("Icon block and shared picker", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  const control = (name) =>
    cy.get(`.shared-editor button[aria-label="${name}"]`).filter(":visible");
  const inspector = () => {
    cy.get('[aria-label="Toggle Inspector"]').then((button) => {
      if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
    });
  };
  const modal = () => cy.get('dialog[aria-label="Choose an icon"][open]');
  const pick = (name) => {
    cy.get(".editor-inspector-sidebar cl-icon-picker")
      .contains("button", "Choose icon")
      .click();
    modal().find('input[aria-label="Search icons"]').clear().type(name);
    modal().find(`[data-icon-name="${name}"]`).click();
    modal().should("not.exist");
  };
  let themeId;
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
    cy.request({
      method: "POST",
      url: "/api/admin/settings",
      headers,
      body: { adminColorMode: "dark" },
    });
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/com.colossal.theme.default/clone",
          headers,
          body: { revision: body.revision, name: "Icon browser test" },
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
      });
  });
  it("inserts, searches, selects and saves an icon with size and accessibility settings", () => {
    cy.intercept("PUT", "/api/themes/*/draft").as("draft");
    cy.visit("/admin/themes/edit/" + themeId);
    control("Blocks").click();
    cy.get('[data-library-block="core/icon"]').click();
    inspector();
    cy.get(".editor-inspector-sidebar .icon-picker-current").should(
      "contain",
      "No icon selected",
    );
    cy.iconCanvas('[aria-label="Icon placeholder"]').should("exist");
    pick("shield");
    cy.get(".editor-inspector-sidebar .icon-picker-current").should(
      "contain",
      "Shield",
    );
    cy.get(".theme-inspector")
      .contains("label", "Icon size (px)")
      .find("input")
      .clear()
      .type("64");
    cy.get(".theme-inspector")
      .contains("label", "Decorative icon")
      .find("input")
      .uncheck();
    cy.get(".theme-inspector")
      .contains("label", "Accessible label")
      .find("input")
      .type("Protected content");
    cy.iconCanvas('svg.theme-icon[aria-label="Protected content"]')
      .should("have.attr", "width", "64")
      .and("have.attr", "role", "img")
      .and("have.attr", "aria-label", "Protected content");
    control("Save draft").click();
    cy.wait("@draft");
    cy.reload();
    cy.iconCanvas('svg.theme-icon[aria-label="Protected content"]')
      .should("have.attr", "aria-label", "Protected content")
      .and("have.attr", "width", "64");
  });
  it("supports empty search, cancel, keyboard selection, Escape, focus return and undo", () => {
    cy.visit("/admin/themes/edit/" + themeId);
    cy.iconCanvas('svg.theme-icon[aria-label="Protected content"]').click();
    cy.get(".editor-inspector-sidebar cl-icon-picker")
      .contains("button", "Choose icon")
      .click();
    modal()
      .find('input[aria-label="Search icons"]')
      .should("be.focused")
      .type("no-such-icon");
    modal().should("contain", "No icons match");
    modal().contains("button", "Cancel").click();
    cy.get(".editor-inspector-sidebar .icon-picker-current").should(
      "contain",
      "Shield",
    );
    cy.get(".editor-inspector-sidebar cl-icon-picker")
      .contains("button", "Choose icon")
      .should("be.focused")
      .click();
    modal().find('input[aria-label="Search icons"]').type("star");
    modal().find('[data-icon-name="star"]').focus().type("{enter}");
    cy.get(".editor-inspector-sidebar .icon-picker-current").should(
      "contain",
      "Star",
    );
    control("Undo").click();
    cy.get(".editor-inspector-sidebar .icon-picker-current").should(
      "contain",
      "Shield",
    );
    cy.get(".editor-inspector-sidebar cl-icon-picker")
      .contains("button", "Choose icon")
      .click();
    modal().find('input[aria-label="Search icons"]').type("{esc}");
    modal().should("not.exist");
    cy.get(".editor-inspector-sidebar cl-icon-picker")
      .contains("button", "Choose icon")
      .should("be.focused");
    setAdminMode("light");
    cy.get(".editor-inspector-sidebar cl-icon-picker")
      .contains("button", "Choose icon")
      .click();
    modal().should((panel) => {
      const color = panel[0].ownerDocument.defaultView.getComputedStyle(
        panel[0],
      ).backgroundColor;
      expect(color).match(/^rgba\(255, 255, 255,/);
    });
    modal().contains("button", "Cancel").click();
  });
  for (const kind of ["post", "page"])
    it(`uses the same picker in the ${kind} editor and persists its selected SVG`, () => {
      cy.visit(`/admin/${kind}s/new`);
      cy.get('input[aria-label="Title"]').type("Icon " + kind);
      control("Blocks").click();
      cy.get('[data-library-block="core/icon"]').click();
      inspector();
      pick("moon");
      cy.get(".editor-inspector-sidebar .icon-picker-current").should(
        "contain",
        "Moon",
      );
      cy.iconCanvas("svg.theme-icon", ".content-live-preview").should(
        "have.attr",
        "width",
        "32",
      );
      control("Save draft").click();
      cy.contains("All changes saved").should("exist");
      cy.reload();
      cy.iconCanvas("svg.theme-icon", ".content-live-preview")
        .should("exist")
        .find("path")
        .should("have.attr", "d", "M21 14a9 9 0 01-11-11A9 9 0 1021 14");
    });
});
