describe("Editor block patterns", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  let themeId;
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
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/" + body.id + "/clone",
          headers,
          body: { revision: body.revision, name: "Pattern test" },
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
        cy.request("/api/themes/" + themeId).then(({ body }) => {
          const document = body.published;
          document.templates.home.children = [
            {
              id: "pattern-baseline",
              type: "core/paragraph",
              settings: { html: "Baseline" },
            },
          ];
          document.manifest.patterns = [
            {
              id: "theme-intro",
              name: "Theme introduction",
              category: "Theme sections",
              blocks: [
                {
                  id: "theme-copy",
                  type: "core/paragraph",
                  settings: { html: "Theme supplied copy" },
                },
              ],
            },
          ];
          cy.request({
            method: "PUT",
            url: "/api/themes/" + themeId + "/draft",
            headers,
            body: { revision: body.revision, document },
          });
        });
      });
  });
  it("opens from rail and dropdown, previews categorized patterns, inserts and undoes one layout", () => {
    cy.visit("/admin/themes/edit/" + themeId);
    cy.get('button[aria-label="Patterns"]').filter(":visible").click();
    cy.get('[aria-label="Pattern library"]').filter(":visible").as("library");
    cy.get("@library").find('[aria-label="Pattern category"]').select("Heroes");
    cy.get("@library").find(".pattern-card").should("have.length", 1);
    cy.get("@library")
      .find('iframe[title="Welcome hero preview"]')
      .should("have.attr", "srcdoc")
      .and("contain", "Make something remarkable");
    cy.get("@library")
      .contains("button", "Welcome hero")
      .should("not.be.disabled")
      .click();
    cy.get(".theme-live-preview").should(($frame) =>
      expect($frame[0].contentDocument.body.textContent).to.contain(
        "Make something remarkable",
      ),
    );
    cy.get('button[aria-label="Undo"]').filter(":visible").click();
    cy.get(".theme-live-preview").should(($frame) =>
      expect($frame[0].contentDocument.body.textContent).not.to.contain(
        "Make something remarkable",
      ),
    );
    cy.get(".editor-panel-selector").filter(":visible").click();
    cy.contains('button[role="menuitem"]', "List view").click();
    cy.get(".editor-panel-selector").filter(":visible").click();
    cy.contains('button[role="menuitem"]', "Patterns").click();
    cy.get("@library")
      .find('[aria-label="Pattern category"]')
      .select("Theme sections");
    cy.get("@library")
      .contains("button", "Theme introduction")
      .should("not.be.disabled")
      .click();
    cy.get(".theme-live-preview").should(($frame) =>
      expect($frame[0].contentDocument.body.textContent).to.contain(
        "Theme supplied copy",
      ),
    );
    cy.intercept("PUT", "/api/themes/" + themeId + "/draft").as("draft");
    cy.get(".editor-save").filter(":visible").click();
    cy.wait("@draft").its("response.statusCode").should("eq", 200);
    cy.request("/api/themes/" + themeId).then(({ body }) =>
      expect(JSON.stringify(body.draft.templates.home)).to.contain(
        "Theme supplied copy",
      ),
    );
  });
  it("offers the same core pattern library in page content editors", () => {
    cy.visit("/admin/pages/edit/about");
    cy.get('button[aria-label="Patterns"]').filter(":visible").click();
    cy.contains(".pattern-card", "Simple call to action")
      .should("not.be.disabled")
      .click();
    cy.get(".content-live-preview").should(($frame) =>
      expect($frame[0].contentDocument.body.textContent).to.contain(
        "Let’s build something together",
      ),
    );
    cy.get('button[aria-label="Undo"]').filter(":visible").click();
    cy.get(".content-live-preview").should(($frame) =>
      expect($frame[0].contentDocument.body.textContent).not.to.contain(
        "Let’s build something together",
      ),
    );
  });
});
