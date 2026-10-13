describe("Independent site icon and logo settings", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  before(() => {
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      headers,
      body: {},
      failOnStatusCode: false,
    });
  });
  it("selects separate images and removing the icon preserves the logo and identity", () => {
    cy.visit("/admin/media");
    cy.contains("button", "Upload media").first().click();
    cy.get('input[type="file"]').selectFile("tests/fixtures/media-sample.svg");
    cy.get('.upload-dialog input[maxlength="500"]').type("Site brand");
    cy.get(".upload-dialog").contains("button", "Upload file").click();
    cy.get(".upload-dialog").should("not.exist");
    cy.visit("/admin/settings");
    for (const label of ["Select site icon", "Select site logo"]) {
      cy.contains("button", label).click();
      cy.get(
        '.media-picker-dialog [aria-label="Select media-sample.svg"]',
      ).click();
      cy.contains("button", "Use selected").click();
    }
    cy.intercept("POST", "/api/admin/settings").as("saveSettings");
    cy.contains("button", "Save changes").click();
    cy.wait("@saveSettings").its("response.statusCode").should("eq", 200);
    cy.request("/api/admin/state").then(({ body }) => {
      const logoId = body.settings.siteLogoId;
      expect(logoId).not.to.eq("");
      cy.get('head link[rel="icon"]').should(
        "have.attr",
        "href",
        `/api/media/${body.settings.siteIconId}/file`,
      );
      cy.contains(".settings-section", "Site icon")
        .contains("button", "Remove")
        .click();
      cy.contains("button", "Save changes").click();
      cy.wait("@saveSettings");
      cy.get('head link[rel="icon"]').should(
        "have.attr",
        "href",
        "/favicon.svg",
      );
      cy.reload();
      cy.contains("button", "Select site icon").should("be.visible");
      cy.contains("button", "Change site logo").should("be.visible");
      cy.request("/api/themes/render").then(({ body: rendered }) => {
        expect(rendered.html).to.contain(`/api/media/${logoId}/file`);
        expect(rendered.siteIcon).to.eq("/favicon.svg");
      });
    });
  });
});
