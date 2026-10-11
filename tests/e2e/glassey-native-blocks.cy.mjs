describe("Glossy native content blocks", () => {
  it("renders native paragraphs, project images, buttons and navigation with its glass layout", () => {
    const headers = { Origin: "http://127.0.0.1:4201" };
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      body: {},
      headers,
      failOnStatusCode: false,
    });
    cy.request({
      method: "PUT",
      url: "/api/admin/editor/preferences",
      headers,
      body: { walkthroughVersion: 1 },
    });
    cy.visit(
      "/admin/themes/edit/com.colossal.theme.colossal-2027?template=home",
    );
    cy.get("iframe.theme-live-preview").should(($frame) => {
      const doc = $frame[0].contentDocument;
      expect(doc.querySelectorAll(".c27-project-image img")).to.have.length(3);
      expect(
        doc.querySelector(".c27-hero-description [data-paragraph-editor]"),
      ).not.eq(null);
      expect(doc.querySelector(".c27-hero-actions .theme-button")).not.eq(null);
      expect(
        doc.defaultView.getComputedStyle(
          doc.querySelector(".c27-hero-actions .c27-cta"),
        ).padding,
      ).eq("15px 22px");
      expect(doc.querySelector(".c27-header-inner .theme-menu-items")).not.eq(
        null,
      );
      expect(doc.querySelector(".c27-header-inner .theme-site-brand")).not.eq(
        null,
      );
      expect(doc.querySelector(".c27-header-inner .c27-brand-monogram")).eq(
        null,
      );
      expect(doc.querySelector(".theme-menu-toggle svg.theme-icon")).not.eq(
        null,
      );
      const card = doc.querySelector(".c27-project");
      expect(doc.defaultView.getComputedStyle(card).backgroundColor).eq(
        "rgba(23, 25, 27, 0.79)",
      );
      const image = doc.querySelector(".c27-project-image img");
      expect(image.getAttribute("src")).eq(
        "/themes/colossal-2027/project-cms.svg",
      );
      expect(
        doc.defaultView.getComputedStyle(image.closest("figure")).margin,
      ).eq("0px");
      expect(
        doc.defaultView.getComputedStyle(
          doc.querySelector(".theme-part-header"),
        ).position,
      ).eq("sticky");
      expect(
        doc.querySelectorAll(
          ".c27-footer-grid > .theme-layout > [data-block-id]",
        ),
      ).to.have.length(3);
    });
    cy.get('.shared-editor button[aria-label="Viewport"]')
      .filter(":visible")
      .click();
    cy.get('[aria-label="Viewport options"]:popover-open')
      .contains("button", "Mobile")
      .click();
    cy.get("iframe.theme-live-preview")
      .should(($frame) => {
        const doc = $frame[0].contentDocument;
        const toggle = doc.querySelector(".theme-menu-toggle");
        expect(doc.defaultView.getComputedStyle(toggle).display).oneOf([
          "flex",
          "inline-flex",
        ]);
      })
      .then(($frame) => {
        const doc = $frame[0].contentDocument;
        const toggle = doc.querySelector(".theme-menu-toggle");
        if (toggle.getAttribute("aria-expanded") === "true") toggle.click();
        expect(
          doc.defaultView.getComputedStyle(
            doc.querySelector(".theme-menu-items"),
          ).display,
        ).eq("none");
        toggle.click();
        expect(toggle.getAttribute("aria-expanded")).eq("true");
        for (const link of doc.querySelectorAll(".theme-menu-items a"))
          expect(doc.defaultView.getComputedStyle(link).display).not.eq("none");
        toggle.click();
        expect(toggle.getAttribute("aria-expanded")).eq("false");
      });
    cy.screenshot("glassey-native-blocks", { capture: "viewport" });
  });
});
