describe("Shared SMTP settings", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  before(() =>
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      headers,
      body: {},
      failOnStatusCode: false,
    }),
  );
  it("defaults to Mail2World, persists non-secret configuration, and uses shared admin inputs", () => {
    cy.viewport(1280, 720);
    cy.visit("/admin/settings");
    cy.contains(".settings-nav button", "SMTP").click();
    cy.get(".smtp-panels > .panel").should("have.length", 2);
    cy.get(".smtp-enabled").should("have.css", "flex-direction", "row");
    cy.get(".smtp-enabled input").should("have.css", "width", "16px");
    cy.get(".smtp-config").then((config) => {
      cy.get(".smtp-test").then((test) => {
        expect(config[0].getBoundingClientRect().right).lessThan(
          test[0].getBoundingClientRect().left,
        );
        expect(test[0].getBoundingClientRect().right).at.most(1280);
        expect(config[0].getBoundingClientRect().top).eq(
          test[0].getBoundingClientRect().top,
        );
      });
    });
    cy.get('cl-smtp-settings select[name="provider"]').should(
      "have.value",
      "mail2world",
    );
    cy.get('cl-smtp-settings input[name="host"]').type("smtp.example.test");
    cy.get('cl-smtp-settings input[name="fromEmail"]').type(
      "sender@example.test",
    );
    cy.contains("button", "Save SMTP settings").click();
    cy.contains('[role="status"]', "SMTP settings saved.").should("be.visible");
    cy.contains(".settings-nav button", "General").click();
    cy.contains(".settings-nav button", "SMTP").click();
    cy.get('cl-smtp-settings input[name="host"]').should(
      "have.value",
      "smtp.example.test",
    );
    cy.get('cl-smtp-settings input[name="password"]').should("have.value", "");
    cy.contains("button", "Verify connection").should("be.disabled");
    cy.screenshot("smtp-two-panels", { capture: "viewport" });
    cy.viewport(390, 844);
    cy.get(".smtp-config").then((config) => {
      cy.get(".smtp-test").then((test) => {
        expect(test[0].getBoundingClientRect().top).greaterThan(
          config[0].getBoundingClientRect().bottom,
        );
      });
    });
  });
});
