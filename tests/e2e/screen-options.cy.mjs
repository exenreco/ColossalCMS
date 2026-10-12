describe("Persistent content Screen options", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
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
  });
  it("toggles matching headers and cells, persists per screen, and updates empty-row spans", () => {
    cy.visit("/admin/pages");
    cy.contains("button", "Screen options")
      .then(($button) => {
        const visit = $button[0]
          .closest(".topbar-actions")
          .querySelector('a[target="_blank"]');
        expect($button[0].getBoundingClientRect().right).to.be.lessThan(
          visit.getBoundingClientRect().left,
        );
      })
      .click();
    const panel = ".admin-screen-options:popover-open";
    cy.get(panel)
      .should("be.visible")
      .and("have.attr", "data-color-mode", "dark");
    cy.get(panel)
      .contains("label", "Title")
      .find("input")
      .should("be.disabled")
      .and("be.checked");
    for (const label of [
      "Slug",
      "Template",
      "Author",
      "Status",
      "Updated",
      "SEO",
      "Views (last 30 days)",
      "Actions",
    ]) {
      cy.get(panel).contains("label", label).find("input").uncheck();
    }
    cy.get("thead th:visible").should("have.length", 2);
    cy.get("tbody tr").first().find("td:visible").should("have.length", 2);
    cy.screenshot("admin-screen-options", { capture: "viewport" });
    cy.get(panel).trigger("keydown", { key: "Escape" });
    cy.contains("button", "Screen options").should(
      "have.attr",
      "aria-expanded",
      "false",
    );
    cy.reload();
    cy.get('th[data-column="status"]').should("not.be.visible");
    cy.get('input[aria-label="Search content"]').type("no matching entries");
    cy.get("td.empty-cell").should("have.attr", "colspan", "2");
    cy.visit("/admin/posts");
    cy.get('th[data-column="status"]').should("be.visible");
    cy.contains("button", "Screen options").click();
    cy.get(panel).contains("label", "Updated").find("input").uncheck();
    cy.get(panel).contains("label", "Slug").should("not.exist");
    cy.reload();
    cy.get('th[data-column="updatedAt"]').should("not.be.visible");
    cy.get('th[data-column="status"]').should("be.visible");
    cy.visit("/admin/pages");
    cy.get('th[data-column="status"]').should("not.be.visible");
    cy.visit("/admin/dashboard");
    cy.contains("button", "Screen options").should("not.exist");
  });
  it("shows public view counts and opens the editor from Actions", () => {
    cy.request({
      method: "POST",
      url: "/api/admin/content",
      headers,
      body: {
        kind: "page",
        title: "Counted page",
        slug: "counted-page",
        status: "published",
        body: "Count this page",
        details: {},
      },
    }).then(({ body }) => {
      cy.request("/counted-page");
      cy.request("/counted-page");
      cy.request("/api/themes/render?path=/counted-page");
      cy.visit("/admin/pages");
      cy.get('input[aria-label="Search content"]').type("Counted page");
      cy.get('td[data-column="views30Days"]').should(($cell) =>
        expect($cell.text().trim()).to.equal("2"),
      );
      cy.get('th[data-column="view"]').should("contain.text", "Actions");
      cy.get(
        'td[data-column="view"] button[aria-label="Edit Counted page"]',
      ).click();
      cy.location("pathname").should("equal", "/admin/pages/edit/" + body.id);
      cy.get(".shared-editor").should("be.visible");
    });
  });
});
