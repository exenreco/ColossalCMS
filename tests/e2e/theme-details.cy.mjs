describe("Theme card details", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
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
      method: "POST",
      url: "/api/admin/settings",
      headers,
      body: { adminColorMode: "dark" },
    });
    cy.request("/api/themes/com.colossal.theme.default").then(({ body }) => {
      cy.request({
        method: "POST",
        url: "/api/themes/" + body.id + "/clone",
        headers,
        body: { name: "Theme details example", revision: body.revision },
      }).then(({ body: theme }) => {
        themeId = theme.id;
      });
    });
  });
  it("shows compact cards and opens the shared details drawer by keyboard", () => {
    cy.visit("/admin/themes");
    cy.contains(".theme-card", "Theme details example").as("card");
    cy.get("@card")
      .find(".theme-card-body p, .theme-card-actions")
      .should("not.exist");
    cy.get("@card")
      .find(".theme-preview-overlay")
      .should("have.css", "opacity", "0");
    cy.get('[aria-label="Theme details for Theme details example"]').focus();
    cy.get("@card")
      .find(".theme-preview-overlay")
      .should("have.css", "opacity", "1");
    cy.get("@card")
      .find('[aria-label="Activate Theme details example"]')
      .should("be.visible");
    cy.get("@card")
      .find('[aria-label="Preview Theme details example"]')
      .should("be.visible");
    cy.get('[aria-label="Theme details for Theme details example"]').click();
    cy.get('cl-admin-modal [role="dialog"]').should(
      "have.attr",
      "aria-label",
      "Theme details example",
    );
    cy.get(".admin-modal-overlay").should(
      "have.css",
      "backdrop-filter",
      "blur(6px)",
    );
    cy.get(".theme-details-preview iframe")
      .should("have.attr", "srcdoc")
      .and("include", "<style>");
    cy.get(".theme-details-description").should("not.be.empty");
    cy.get(".theme-details-actions .button")
      .should("have.length", 5)
      .each((button) => {
        cy.wrap(button)
          .find("cl-icon svg path")
          .should("have.attr", "d")
          .and("not.be.empty");
      });
    cy.get(".theme-details-actions")
      .contains("a", "Export")
      .should("have.attr", "href", `/api/themes/${themeId}/export`);
    cy.screenshot("theme-details-dark");
    cy.get("body").type("{esc}");
    cy.get("cl-admin-modal").should("not.exist");
    cy.get('[aria-label="Theme details for Theme details example"]').should(
      "be.focused",
    );
  });
  it("previews and activates through icon actions, then edits from details", () => {
    cy.visit("/admin/themes");
    cy.window().then((win) => cy.stub(win, "open").as("previewWindow"));
    cy.get('[aria-label="Preview Theme details example"]').focus().click();
    cy.get("@previewWindow").should("have.been.calledOnce");
    cy.on("window:confirm", () => true);
    cy.get('[aria-label="Activate Theme details example"]').focus().click();
    cy.contains(".theme-card", "Theme details example").should(
      "contain.text",
      "Active theme",
    );
    cy.contains(".theme-card", "Theme details example")
      .find('[aria-label="Activate Theme details example"]')
      .should("not.exist");
    cy.get('[aria-label="Theme details for Theme details example"]').click();
    cy.get(".theme-details-actions")
      .contains("button", "Delete")
      .should("not.exist");
    cy.get(".theme-details-meta").should("contain.text", "Active theme");
    cy.get(".theme-details-actions").contains("a", "Edit theme").click();
    cy.get("cl-admin-modal").should("not.exist");
    cy.location("pathname").should("eq", `/admin/themes/edit/${themeId}`);
  });
});
