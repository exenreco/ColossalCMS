describe("Connections settings sections", () => {
  before(() => {
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      headers: { Origin: "http://127.0.0.1:4201" },
      body: {},
      failOnStatusCode: false,
    });
  });
  it("keeps provider edits across sections and exposes migration and heartbeat separately", () => {
    // Mask real bootstrap values and make both provider paths editable without saving or connecting.
    cy.intercept("GET", "/api/admin/connections", (req) => {
      req.continue((res) => {
        res.body.fields = res.body.fields.map((field) => ({
          ...field,
          managed: false,
          readOnly: false,
          configured: false,
          value: field.secret
            ? ""
            : field.key === "CMS_DB_PROVIDER"
              ? "mongodb"
              : field.key === "CMS_STORAGE_PROVIDER"
                ? "gridfs"
                : field.value,
        }));
        res.body.readOnly = false;
      });
    }).as("connections");
    cy.viewport(1440, 1000);
    cy.visit("/admin/connections");
    cy.wait("@connections");
    const section = (name) =>
      cy.contains('nav[aria-label="Connection sections"] button', name).click();
    cy.contains('nav[aria-label="Connection sections"] button', "Setup").should(
      "have.attr",
      "aria-current",
      "page",
    );
    cy.get("#CMS_SETUP_TOKEN").should("be.visible");
    cy.get("#CMS_DB_PROVIDER").should("not.exist");
    section("Database Provider");
    cy.get("#CMS_DB_PROVIDER").select("d1");
    cy.get("#CLOUDFLARE_D1_DATABASE_ID")
      .should("be.visible")
      .type("draft-database-id");
    cy.get("#MONGODB_URI").should("not.exist");
    section("Storage Provider");
    cy.get("#CMS_STORAGE_PROVIDER").select("r2");
    cy.get("#R2_BUCKET").clear().type("draft-media");
    section("Connection Console");
    cy.get('[role="log"]').should("be.visible");
    cy.contains("button", "Test connections").should("be.disabled");
    section("Database Provider");
    cy.get("#CMS_DB_PROVIDER").should("have.value", "d1");
    cy.get("#CLOUDFLARE_D1_DATABASE_ID").should(
      "have.value",
      "draft-database-id",
    );
    section("Storage Provider");
    cy.get("#R2_BUCKET").should("have.value", "draft-media");
    section("Heartbeat");
    cy.get("#heartbeatInterval").should("be.visible");
    cy.get("#CRON_SECRET").should("be.visible");
    cy.viewport(390, 844);
    section("Setup");
    cy.get("#CMS_SETUP_TOKEN").should("be.visible");
    cy.get('nav[aria-label="Connection sections"]').then(($nav) => {
      const rect = $nav[0].getBoundingClientRect();
      expect(rect.right).to.be.at.most(390);
    });
  });
});
