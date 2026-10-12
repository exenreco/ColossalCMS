describe("Admin controls and content toolbar layout", () => {
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
  it("uses dark notifications and consistent SEO and security fields", () => {
    cy.request("/api/admin/state").then(({ body: state }) => {
      state.notices = [
        {
          id: "visual-notice",
          message: "Dashboard notification",
          created_at: new Date().toISOString(),
        },
      ];
      const events = [1, 2, 3, 4].map((completed) => ({
        type: "progress",
        completed,
        total: 4,
        message: "Preparing workspace",
      }));
      events.push({ type: "complete", state });
      cy.intercept("GET", "/api/admin/bootstrap", {
        headers: { "Content-Type": "application/x-ndjson" },
        body: events.map((event) => JSON.stringify(event)).join("\n") + "\n",
      });
    });
    cy.visit("/admin/dashboard");
    cy.get(".dashboard-notice")
      .should("be.visible")
      .and("have.css", "color", "rgb(232, 236, 233)");
    cy.get(".dashboard-notice").should(($notice) => {
      expect($notice.css("background-color")).not.to.equal(
        "rgb(251, 244, 223)",
      );
    });
    for (const route of ["login-security", "seo"]) {
      cy.visit("/admin/" + route);
      cy.get('.admin-plugin-form input:not([type="checkbox"])')
        .first()
        .should("have.css", "background-color", "rgb(14, 14, 14)")
        .and("have.css", "border-top-style", "solid")
        .and("have.css", "border-radius", "7px");
      cy.screenshot("admin-" + route + "-fields", { capture: "viewport" });
    }
  });
  it("places status and search above the bulk row and table on both content screens", () => {
    for (const route of ["pages", "posts"]) {
      cy.visit("/admin/" + route);
      cy.get('.content-filter-panel [aria-label="Content status"]').should(
        "be.visible",
      );
      cy.get(".content-filter-columns").should("have.css", "display", "grid");
      cy.get(".content-filter-panel").then(($panel) => {
        const panel = $panel[0];
        const tabs = panel.querySelector(".tabs").getBoundingClientRect();
        const search = panel
          .querySelector(".search-field")
          .getBoundingClientRect();
        expect(search.left).to.be.greaterThan(tabs.left);
        expect(Math.abs(search.top - tabs.top)).to.be.lessThan(10);
        cy.get(".content-actions-row").then(($row) => {
          expect($row[0].getBoundingClientRect().top).to.be.greaterThan(
            panel.getBoundingClientRect().bottom,
          );
          expect($row.find('select[aria-label="Bulk action"]')).to.have.length(
            1,
          );
        });
      });
      cy.get(".table-scroll .tabs, .table-scroll cl-bulk-actions").should(
        "not.exist",
      );
      cy.screenshot("admin-" + route + "-toolbar", { capture: "viewport" });
    }
    cy.viewport(390, 720);
    cy.visit("/admin/pages");
    cy.get(".content-filter-columns .search-field").then(($search) => {
      expect($search[0].getBoundingClientRect().right).to.be.at.most(390);
    });
  });
});
