describe("Dashboard view comparisons and shared SEO charts", () => {
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
  it("plots both view periods and supports keyboard exploration and daily data", () => {
    cy.request("/api/admin/state").then(({ body: state }) => {
      const currentSeries = Array(31).fill(0);
      currentSeries[30] = 5;
      const previousSeries = Array(31).fill(0);
      previousSeries[30] = 2;
      state.viewAnalytics.page = {
        current: 5,
        previous: 2,
        currentSeries,
        previousSeries,
      };
      state.viewAnalytics.post = {
        current: 1,
        previous: 4,
        currentSeries: Array(31)
          .fill(0)
          .map((n, i) => (i === 30 ? 1 : n)),
        previousSeries: Array(31)
          .fill(0)
          .map((n, i) => (i === 30 ? 4 : n)),
      };
      const events = [1, 2, 3, 4].map((completed) => ({
        type: "progress",
        completed,
        total: 4,
        message: "Preparing workspace",
      }));
      events.push({ type: "complete", state });
      cy.intercept("GET", "/api/admin/state", { body: state });
      cy.intercept("GET", "/api/admin/bootstrap", {
        headers: { "Content-Type": "application/x-ndjson" },
        body: events.map((e) => JSON.stringify(e)).join("\n") + "\n",
      });
    });
    cy.visit("/admin/dashboard");
    cy.get(".views-overview").should("be.visible");
    cy.get("cl-views-chart").should("have.length", 2);
    cy.get("cl-views-chart")
      .first()
      .within(() => {
        cy.get(".chart-summary strong").should("have.text", "5");
        cy.get(".chart-change").should("have.text", "+150%");
        cy.get(".chart-line").should("have.length", 2);
        cy.get(".views-plot").focus().type("{leftarrow}");
        cy.get(".chart-detail").should("contain.text", ": 0");
        cy.contains("summary", "View daily data").click();
        cy.get("tbody tr").should("have.length", 31);
        cy.contains("summary", "View daily data").click();
      });
    cy.get("cl-views-chart")
      .last()
      .find(".chart-change")
      .should("have.text", "-75%");
    cy.get(".views-overview").scrollIntoView();
    cy.screenshot("dashboard-views-charts", { capture: "viewport" });
  });
  it("reuses SEO charts above Site identity, respects plugin activation, and renders in both modes", () => {
    cy.visit("/admin/dashboard");
    cy.get(".seo-overview").should("have.length", 1);
    cy.get(".seo-type-chart").should("have.length", 2);
    cy.get(".seo-overview").scrollIntoView();
    cy.screenshot("dashboard-seo-charts", { capture: "viewport" });
    cy.visit("/admin/seo");
    cy.get(".seo-overview")
      .should("have.length", 1)
      .then(($overview) => {
        cy.get(".seo-settings").then(($settings) => {
          expect($overview[0].getBoundingClientRect().bottom).to.be.lessThan(
            $settings[0].getBoundingClientRect().top,
          );
        });
      });
    cy.contains("h2", "Content SEO overview").should("not.exist");
    cy.screenshot("seo-page-shared-overview", { capture: "viewport" });
    cy.request({
      method: "POST",
      url: "/api/admin/plugins",
      headers,
      body: { id: "com.colossal.seo", action: "deactivate" },
    });
    cy.visit("/admin/dashboard");
    cy.get(".seo-overview").should("not.exist");
    cy.get(".views-overview").should("exist");
    cy.request({
      method: "POST",
      url: "/api/admin/plugins",
      headers,
      body: { id: "com.colossal.seo", action: "activate" },
    });
    cy.request({
      method: "POST",
      url: "/api/admin/settings",
      headers,
      body: { adminColorMode: "light" },
    });
    cy.viewport(390, 720);
    cy.visit("/admin/dashboard");
    cy.get(".seo-overview").should("exist");
    cy.get(".views-overview").should(
      "have.css",
      "background-color",
      "rgb(255, 255, 255)",
    );
    cy.get(".views-plot")
      .first()
      .then(($plot) =>
        expect($plot[0].getBoundingClientRect().right).to.be.at.most(390),
      );
    cy.get(".seo-overview svg")
      .first()
      .then(($plot) =>
        expect($plot[0].getBoundingClientRect().right).to.be.at.most(390),
      );
    cy.get(".views-overview").scrollIntoView();
    cy.screenshot("dashboard-mobile-charts", { capture: "viewport" });
  });
});
