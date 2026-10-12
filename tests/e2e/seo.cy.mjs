describe("Advanced SEO plugin", () => {
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
      method: "PUT",
      url: "/api/admin/editor/preferences",
      headers,
      body: { walkthroughVersion: 1, colorMode: "dark" },
    });
  });
  it("configures site-wide schema and shows the content overview", () => {
    cy.visit("/admin/settings");
    cy.get('select[name="titleFormat"]').select("site-page");
    cy.get('select[name="titleSeparator"]').select("|");
    cy.contains("strong", "Colossal Journal | About us").should("be.visible");
    cy.intercept("POST", "/api/admin/settings").as("titleSettings");
    cy.contains("button", "Save changes").click();
    cy.wait("@titleSettings").its("response.statusCode").should("eq", 200);
    cy.reload();
    cy.get('select[name="titleFormat"]').should("have.value", "site-page");
    cy.visit("/admin/seo");
    cy.contains("h1", "Make your content easier to discover.").should(
      "be.visible",
    );
    cy.contains("label", "Publisher / organization name")
      .find("input")
      .clear()
      .type("SEO Browser Studio");
    cy.contains("label", "Default page schema")
      .find("select")
      .select("WebPage");
    cy.contains("button", "Save SEO settings").click();
    cy.contains("SEO settings saved.").should("be.visible");
    cy.reload();
    cy.contains("label", "Publisher / organization name")
      .find("input")
      .should("have.value", "SEO Browser Studio");
    cy.contains("h2", "Content SEO overview").should("be.visible");
  });
  for (const kind of ["page", "post"])
    it(`scores ${kind} content, previews desktop/mobile, and persists schema and indexing options`, () => {
      cy.request({
        method: "POST",
        url: "/api/admin/content",
        headers,
        body: {
          kind,
          title: "A complete guide to thoughtful design",
          slug: `seo-browser-${kind}`,
          excerpt:
            "Thoughtful design helps people find clarity. Learn practical methods for planning, creating, and refining useful websites with this detailed guide.",
          body: "Thoughtful design " + "word ".repeat(160),
          status: "draft",
          details: {},
        },
      }).then(({ body }) => {
        cy.visit(`/admin/${kind}s/edit/${body.id}`);
        cy.get('[aria-label="Toggle Inspector"]').then((button) => {
          if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
        });
        cy.get(".editor-inspector-sidebar").contains("summary", /^SEO/).click();
        cy.get("cl-seo-panel .seo-score").should("contain", "/ 100");
        cy.get("cl-seo-panel")
          .contains("label", `This ${kind} is pillar content`)
          .find('input[type="checkbox"]')
          .check();
        cy.get("cl-seo-panel .preview-title")
          .first()
          .should(
            "contain",
            "Colossal Journal | A complete guide to thoughtful design",
          );
        cy.get("cl-seo-panel")
          .contains("label", "Focus keyword")
          .find("input")
          .type("thoughtful design");
        cy.get("cl-seo-panel .seo-checks")
          .contains("li", "Focus keyword appears in the title")
          .find("span")
          .should("have.class", "good");
        cy.contains("button", "Expand search preview").click();
        cy.get(".expanded-preview .search-preview")
          .should("be.visible")
          .invoke("outerWidth")
          .should("be.greaterThan", 500);
        cy.get(".expanded-preview").contains("button", "Mobile").click();
        cy.get(".expanded-preview .search-preview.mobile")
          .invoke("outerWidth")
          .should("be.lessThan", 400);
        cy.get('[aria-label="Close search preview"]').click();
        cy.get("cl-seo-panel").contains("summary", "Structured data").click();
        cy.get("cl-seo-panel")
          .contains("label", "Schema type")
          .find("select")
          .select("Article");
        cy.get("cl-seo-panel")
          .contains("label", "Public author")
          .find("input")
          .type("Public Writer");
        cy.get("cl-seo-panel").contains("summary", "Indexing").click();
        cy.get("cl-seo-panel")
          .contains("label", "Exclude from search")
          .find("input")
          .check();
        cy.get('button[aria-label="Save draft"]').filter(":visible").click();
        cy.contains("All changes saved").should("exist");
        cy.request("/api/admin/state").then(({ body: state }) => {
          const entry = state.content.find((entry) => entry.id === body.id);
          expect(entry.details.seo.focusKeyword).to.equal("thoughtful design");
          expect(entry.details.seo.schemaType).to.equal("Article");
          expect(entry.details.seo.noindex).to.equal(true);
          expect(entry.details.seo.pillarContent).to.equal(true);
        });
        cy.visit(`/admin/${kind}s`);
        cy.contains("tr", "A complete guide to thoughtful design").should(
          "contain",
          "/ 100",
        );
        cy.contains("tr", "A complete guide to thoughtful design")
          .find('[aria-label="Pillar content"]')
          .should("be.visible");
      });
    });
});
