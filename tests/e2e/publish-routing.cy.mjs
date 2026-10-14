describe("Publication status and Reading routing survive editor saves", () => {
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
      body: { walkthroughVersion: 1 },
    });
  });
  for (const kind of ["page", "post"]) {
    it(`keeps a published ${kind} published through Save, Ctrl+S and revision restore`, () => {
      const content = {
        kind,
        title: "Status " + kind,
        slug: "status-" + kind,
        body: "Original revision",
        status: "draft",
        details: {},
      };
      cy.request({
        method: "POST",
        url: "/api/admin/content",
        headers,
        body: content,
      }).then(({ body: made }) => {
        cy.request({
          method: "POST",
          url: "/api/admin/content",
          headers,
          body: {
            ...content,
            id: made.id,
            status: "published",
            body: "Live revision",
          },
        });
        if (kind === "page")
          cy.request({
            method: "POST",
            url: "/api/admin/settings",
            headers,
            body: {
              routingVersion: 2,
              homePageId: made.id,
              postsPageId: "",
              notFoundPageId: "",
              postRouting: "page",
            },
          });
        cy.visit(`/admin/${kind}s/edit/${made.id}`);
        cy.intercept("POST", "/api/admin/content").as("saveContent");
        cy.get(".editor-save")
          .filter(":visible")
          .should("have.attr", "aria-label", "Save changes")
          .click();
        cy.wait("@saveContent")
          .its("request.body.status")
          .should("eq", "published");
        cy.get(".editor-save").filter(":visible").should("not.be.disabled");
        cy.get("body").type("{ctrl}s");
        cy.wait("@saveContent")
          .its("request.body.status")
          .should("eq", "published");
        cy.get(".editor-save").filter(":visible").should("not.be.disabled");
        cy.get('[aria-label="Toggle Inspector"]')
          .filter(":visible")
          .then(($button) => {
            if ($button.attr("aria-pressed") !== "true")
              cy.wrap($button).click();
          });
        cy.get(".revision-list")
          .closest("details")
          .filter(":visible")
          .find("summary")
          .first()
          .click();
        cy.get(".revision-list button").last().click();
        cy.get(".editor-save")
          .filter(":visible")
          .should("have.attr", "aria-label", "Save changes")
          .click();
        cy.wait("@saveContent")
          .its("request.body.status")
          .should("eq", "published");
        cy.get(".editor-save").filter(":visible").should("not.be.disabled");
        // An explicit status choice still takes effect.
        cy.get("label")
          .filter(":visible")
          .contains("Status")
          .find("select")
          .select("draft");
        cy.get(".editor-save").filter(":visible").click();
        cy.wait("@saveContent")
          .its("request.body.status")
          .should("eq", "draft");
        cy.get(".editor-save").filter(":visible").should("not.be.disabled");
        cy.request("/api/admin/state").then(({ body: state }) => {
          expect(state.content.find((c) => c.id === made.id).status).to.eq(
            "draft",
          );
          if (kind === "page") expect(state.settings.homePageId).to.eq(made.id);
        });
        if (kind === "page") {
          cy.visit("/admin/settings");
          cy.contains(".settings-nav button", "Reading").click();
          cy.get('select[name="homePageId"]').should("have.value", made.id);
          cy.contains("form", "Pages & Routing")
            .contains("button", "Save changes")
            .click();
          cy.contains('[role="alert"]', "published").should("not.exist");
        }
      });
    });
  }
});
