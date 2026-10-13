describe("Site Identity image placeholder", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  it("shows a compact selectable image placeholder when no site image is configured", () => {
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
    cy.request({
      method: "POST",
      url: "/api/admin/settings",
      headers,
      body: { logo: "", siteIconId: "", siteLogoId: "" },
    });
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/" + body.id + "/clone",
          headers,
          body: { revision: body.revision, name: "Identity preview" },
        }),
      )
      .then(({ body }) => {
        const id = body.id;
        cy.request("/api/themes/" + id).then(({ body }) => {
          const document = body.draft || body.published;
          document.templates.home.children = [
            {
              id: "blk_empty_identity",
              type: "core/site-brand",
              settings: { display: "logo" },
            },
          ];
          cy.request({
            method: "PUT",
            url: "/api/themes/" + id + "/draft",
            headers,
            body: { revision: body.revision, document },
          });
        });
        cy.visit("/admin/themes/edit/" + id);
        cy.get(".theme-live-preview")
          .should(($frame) => {
            const placeholder = $frame[0].contentDocument.querySelector(
              '[data-block-id="blk_empty_identity"] [aria-label="Site image placeholder"]',
            );
            expect(placeholder).to.exist;
            expect(placeholder.querySelector("svg")).to.exist;
            expect(placeholder.getBoundingClientRect().height).to.be.lessThan(
              70,
            );
          })
          .then(($frame) => {
            $frame[0].contentDocument
              .querySelector('[aria-label="Site image placeholder"]')
              .click();
          });
        cy.get(
          '.contextual-block-toolbar[aria-label="Block tools for Site identity"]',
        ).should("be.visible");
        cy.request("/api/themes/" + id).then(({ body }) =>
          expect(JSON.stringify(body.draft)).not.contain(
            "cl-editor-block-placeholder",
          ),
        );
      });
  });
});
