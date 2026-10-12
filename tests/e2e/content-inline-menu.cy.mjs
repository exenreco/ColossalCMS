describe("Content title inline menus", () => {
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
  for (const kind of ["page", "post"])
    it(`${kind} menus preserve layout and support Quick Edit, Delete and Instant Index`, () => {
      cy.request({
        method: "POST",
        url: "/api/admin/content",
        headers,
        body: {
          kind,
          title: `Inline ${kind} example`,
          slug: `inline-${kind}-example`,
          excerpt: "Example",
          body: "Example body",
          status: "published",
          details: {},
        },
      }).then(({ body }) => {
        cy.visit(`/admin/${kind}s`);
        cy.contains("tr", `Inline ${kind} example`).as("row");
        cy.get("@row")
          .find(".title-inline-menu")
          .should("have.css", "opacity", "0");
        cy.get("@row").then((row) => {
          const before = row[0].getBoundingClientRect();
          cy.get("@row").find(".title-button").focus();
          cy.get("@row")
            .find(".title-inline-menu")
            .should("have.css", "opacity", "1");
          cy.get("@row").then((after) => {
            const box = after[0].getBoundingClientRect();
            expect(box.height).to.equal(before.height);
            expect(box.width).to.equal(before.width);
            expect(box.top).to.equal(before.top);
          });
        });
        cy.get("@row").contains("button", "Quick Edit").click();
        cy.contains("h2", `Quick Edit ${kind}`).should("be.visible");
        if (kind === "page")
          cy.get('form.quick-edit-dialog input[name="order"]')
            .should("have.value", "0")
            .clear()
            .type("-2");
        else
          cy.get('form.quick-edit-dialog input[name="order"]').should(
            "not.exist",
          );
        cy.get('form.quick-edit-dialog input[name="title"]')
          .clear()
          .type(`Updated inline ${kind}`);
        cy.get("form.quick-edit-dialog").contains("button", "Save").click();
        cy.contains("tr", `Updated inline ${kind}`).as("updated");
        if (kind === "page") {
          cy.get("tbody tr").first().should("contain", "Updated inline page");
          cy.reload();
          cy.get("tbody tr").first().should("contain", "Updated inline page");
          cy.get("@updated").find(".title-button").focus();
          cy.get("@updated").contains("button", "Quick Edit").click();
          cy.get('form.quick-edit-dialog input[name="order"]').should(
            "have.value",
            "-2",
          );
          cy.get("form.quick-edit-dialog").contains("button", "Cancel").click();
        }
        cy.get("@updated").find(".title-button").focus();
        cy.get("@updated").contains("button", "Delete").click();
        cy.contains("h2", `Delete this ${kind}?`).should("be.visible");
        cy.contains("button", `Keep ${kind}`).click();
        cy.intercept("POST", "/api/admin/seo/index", {
          statusCode: 200,
          body: {
            submitted: true,
            message: "URL submitted to IndexNow. Indexing is not guaranteed.",
          },
        }).as("index");
        cy.get("@updated").find(".title-button").focus();
        cy.get("@updated").contains("button", "Instant Index").click();
        cy.wait("@index")
          .its("request.body.contentId")
          .should("equal", body.id);
        cy.contains("URL submitted to IndexNow.").should("be.visible");
      });
    });
  it("hides Instant Index when SEO is deactivated", () => {
    cy.request({
      method: "POST",
      url: "/api/admin/plugins",
      headers,
      body: { id: "com.colossal.seo", action: "deactivate" },
    });
    cy.visit("/admin/pages");
    cy.get(".title-inline-menu")
      .should("contain", "Quick Edit")
      .and("not.contain", "Instant Index");
  });
});
