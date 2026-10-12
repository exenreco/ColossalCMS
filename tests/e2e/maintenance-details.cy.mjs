describe("Maintenance layout cards and details", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  let layout;
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
    cy.request({
      method: "POST",
      url: "/api/admin/plugins",
      headers,
      body: { id: "com.colossal.maintenance", action: "activate" },
    });
    cy.request("/api/maintenance").then(({ body }) => {
      layout = body.layouts.find((item) => !item.active);
    });
  });
  it("uses compact cards, keyboard hover controls, and the shared details sidebar", () => {
    cy.visit("/admin/maintenance");
    cy.get(".theme-card").should("have.length", 3);
    cy.contains(".theme-card", layout.name).as("card");
    cy.get("@card")
      .find(".theme-card-body p, .theme-card-actions")
      .should("not.exist");
    cy.get("@card").find(".theme-details-trigger").focus();
    cy.get("@card")
      .find(".maintenance-views")
      .should("have.text", "0 views · last 30 days");
    cy.get("@card")
      .find(".theme-preview-overlay")
      .should("have.css", "opacity", "1");
    cy.get("@card")
      .find(".theme-preview-actions button")
      .should("contain.text", "Use layout");
    cy.get("@card")
      .find(".theme-preview-actions a")
      .should("contain.text", "Preview")
      .and("have.attr", "href", `/api/maintenance/${layout.id}/preview`);
    cy.get("@card").find(".theme-details-trigger").click();
    cy.get('cl-admin-modal [role="dialog"]').should(
      "have.attr",
      "aria-label",
      layout.name,
    );
    cy.get(".theme-details-preview").should("have.css", "height", "280px");
    cy.get(".theme-details-description").should(
      "have.text",
      layout.description,
    );
    cy.get(".theme-details-meta").should(
      "contain.text",
      "Views · last 30 days",
    );
    cy.get(".theme-details-actions .button")
      .should("have.length", 4)
      .each((button) => {
        cy.wrap(button)
          .find("cl-icon svg path")
          .should("have.attr", "d")
          .and("not.be.empty");
      });
    cy.get(".theme-details-actions").contains("button", "Use layout").click();
    cy.get(".theme-details-meta").should("contain.text", "Selected layout");
    cy.get(".theme-details-actions")
      .contains("button", "Delete")
      .should("not.exist");
    cy.request("/api/maintenance").then(({ body }) => {
      expect(body.settings.layoutId).to.eq(layout.id);
      expect(body.settings.enabled).to.eq(false);
    });
    cy.screenshot("maintenance-details-dark", { capture: "viewport" });
    cy.get("body").type("{esc}");
    cy.get("cl-admin-modal").should("not.exist");
    cy.get("@card").find(".theme-details-trigger").should("be.focused").click();
    cy.get(".theme-details-actions").contains("a", "Edit layout").click();
    cy.location("pathname").should(
      "eq",
      `/admin/maintenance/edit/${layout.id}`,
    );
    cy.get("cl-admin-modal").should("not.exist");
  });
  it("shows Midnight's native identity header and login button without a diagonal backdrop", () => {
    cy.visit("/admin/media");
    cy.contains("button", "Upload media").first().click();
    cy.get('input[type="file"]').selectFile("tests/fixtures/media-sample.svg");
    cy.get('.upload-dialog input[maxlength="500"]').type("Studio logo");
    cy.get(".upload-dialog").contains("button", "Upload file").click();
    cy.get(".upload-dialog").should("not.exist");
    cy.request("/api/admin/state").then(({ body }) => {
      const media = body.media.find((item) => item.name === "media-sample.svg");
      cy.request({
        method: "POST",
        url: "/api/admin/settings",
        headers,
        body: {
          title: "Midnight Studio",
          tagline: "A new experience is coming",
          siteIconId: media.id,
        },
      });
    });
    cy.visit("/api/maintenance/com.colossal.maintenance.midnight/preview");
    cy.get(".midnight-brand-logo .theme-site-logo")
      .should("have.attr", "src")
      .and("include", "/api/media/");
    cy.get(".midnight-brand-name").should("contain.text", "Midnight Studio");
    cy.get(".midnight-brand-tagline").should(
      "contain.text",
      "A new experience is coming",
    );
    cy.get(".midnight-login")
      .should("contain.text", "Login")
      .and("have.attr", "href", "/login");
    cy.get(".midnight-header").should("have.css", "position", "fixed");
    cy.get(".midnight-header").then((header) => {
      expect(header[0].getBoundingClientRect().top).to.be.lessThan(80);
    });
    cy.get(".midnight-login svg path")
      .should("have.attr", "d")
      .and("include", "M15 3h6v18h-6");
    cy.get(".maintenance-geometry")
      .should("have.css", "background-image")
      .and("not.include", "linear-gradient");
    cy.get(".midnight-login").then((login) => {
      cy.get(".midnight-brand").then((brand) => {
        expect(brand[0].getBoundingClientRect().right).to.be.lessThan(
          login[0].getBoundingClientRect().left,
        );
      });
    });
    cy.screenshot("midnight-header-desktop", { capture: "viewport" });
    cy.viewport(390, 844);
    cy.get(".midnight-header").should("be.visible");
    cy.get(".midnight-login").then((login) => {
      cy.get(".midnight-brand").then((brand) => {
        expect(brand[0].getBoundingClientRect().right).to.be.lessThan(
          login[0].getBoundingClientRect().left,
        );
        expect(brand[0].getBoundingClientRect().right).to.be.at.most(390);
      });
    });
    cy.screenshot("midnight-header-mobile", { capture: "viewport" });
    cy.viewport(1280, 720);
    cy.visit("/admin/maintenance/edit/com.colossal.maintenance.midnight");
    cy.get("iframe.theme-live-preview").should(($frame) => {
      const doc = $frame[0].contentDocument;
      const geometry = doc.querySelector(".maintenance-geometry");
      expect(geometry).not.eq(null);
      expect(
        doc.defaultView.getComputedStyle(geometry).backgroundImage,
      ).not.contain("linear-gradient");
      const brand = doc
        .querySelector(".midnight-brand")
        .getBoundingClientRect();
      const login = doc
        .querySelector(".midnight-login")
        .getBoundingClientRect();
      expect(brand.right).lessThan(login.left);
    });
  });
});
